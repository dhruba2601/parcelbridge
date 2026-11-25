-- PARCELBRIDGE: Atomic Scheduling Transactions & Updated-At Triggers
-- Migration: 202611250003_atomic_scheduling_and_triggers.sql

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'societies', 'parcel_hubs', 'profiles', 'courier_partners',
    'business_partners', 'delivery_personnel', 'parcels',
    'delivery_slots', 'delivery_bookings', 'delivery_assignments',
    'return_requests', 'support_tickets'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;
      CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
    ', t, t, t, t);
  END LOOP;
END;
$$;

-- Atomic Slot Reservation (prevents race conditions on final slot capacity)
CREATE OR REPLACE FUNCTION public.reserve_delivery_slot(
  p_parcel_id UUID,
  p_customer_id UUID,
  p_slot_id UUID,
  p_instructions TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
  v_parcel RECORD;
  v_booking_id UUID;
BEGIN
  -- Lock parcel row first to prevent duplicate concurrent bookings for same parcel
  SELECT * INTO v_parcel FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARCEL_NOT_FOUND';
  END IF;

  IF v_parcel.customer_id <> p_customer_id THEN
    RAISE EXCEPTION 'FORBIDDEN_PARCEL_ACCESS';
  END IF;

  IF v_parcel.current_status NOT IN ('Stored', 'Ready for delivery', 'Delivery attempted', 'Delivery scheduled') THEN
    RAISE EXCEPTION 'PARCEL_NOT_ELIGIBLE_FOR_SCHEDULING';
  END IF;

  -- Lock target slot row exclusively
  SELECT * INTO v_slot FROM public.delivery_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND OR NOT v_slot.is_active THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;

  IF v_slot.society_id <> v_parcel.society_id OR v_slot.hub_id <> v_parcel.hub_id THEN
    RAISE EXCEPTION 'SLOT_HUB_SOCIETY_MISMATCH';
  END IF;

  IF v_slot.booked_count >= v_slot.max_capacity THEN
    RAISE EXCEPTION 'SLOT_CAPACITY_FULL';
  END IF;

  -- Cancel any existing confirmed booking for this parcel and release its capacity
  UPDATE public.delivery_slots ds
  SET booked_count = GREATEST(0, ds.booked_count - 1)
  FROM public.delivery_bookings db
  WHERE db.parcel_id = p_parcel_id
    AND db.status = 'confirmed'
    AND ds.id = db.slot_id;

  UPDATE public.delivery_bookings
  SET status = 'rescheduled'
  WHERE parcel_id = p_parcel_id AND status = 'confirmed';

  -- Increment slot capacity atomically
  UPDATE public.delivery_slots
  SET booked_count = booked_count + 1
  WHERE id = p_slot_id;

  -- Create confirmed booking
  INSERT INTO public.delivery_bookings (parcel_id, customer_id, slot_id, status, delivery_instructions, is_demo)
  VALUES (p_parcel_id, p_customer_id, p_slot_id, 'confirmed', p_instructions, v_parcel.is_demo)
  RETURNING id INTO v_booking_id;

  -- Update parcel status
  UPDATE public.parcels
  SET current_status = 'Delivery scheduled'
  WHERE id = p_parcel_id;

  INSERT INTO public.parcel_events (parcel_id, previous_status, new_status, actor_id, actor_role, notes)
  VALUES (p_parcel_id, v_parcel.current_status, 'Delivery scheduled', p_customer_id, 'customer', 'Delivery slot reserved atomically');

  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'slot_id', p_slot_id,
    'remaining_capacity', v_slot.max_capacity - (v_slot.booked_count + 1)
  );
END;
$$;
