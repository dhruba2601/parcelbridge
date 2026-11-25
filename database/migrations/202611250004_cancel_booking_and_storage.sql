-- PARCELBRIDGE: Atomic Booking Cancellation RPC & Storage Bucket Policies
-- Migration: 202611250004_cancel_booking_and_storage.sql

CREATE OR REPLACE FUNCTION public.cancel_delivery_booking(
  p_booking_id UUID,
  p_actor_id UUID,
  p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT * INTO v_booking FROM public.delivery_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF NOT p_is_admin AND v_booking.customer_id <> p_actor_id THEN
    RAISE EXCEPTION 'FORBIDDEN_BOOKING_ACCESS';
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'INVALID_BOOKING_STATE';
  END IF;

  UPDATE public.delivery_bookings
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_booking_id;

  UPDATE public.delivery_slots
  SET booked_count = GREATEST(0, booked_count - 1)
  WHERE id = v_booking.slot_id;

  UPDATE public.parcels
  SET current_status = 'Stored'
  WHERE id = v_booking.parcel_id
    AND current_status = 'Delivery scheduled';

  RETURN jsonb_build_object(
    'id', v_booking.id,
    'parcel_id', v_booking.parcel_id,
    'slot_id', v_booking.slot_id,
    'status', 'cancelled'
  );
END;
$$;

-- Supabase Storage Bucket for Delivery/Return Photo Proofs (private by default)
INSERT INTO storage.buckets (id, name, public)
VALUES ('parcel-proofs', 'parcel-proofs', FALSE)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'parcel_proofs_staff_upload'
  ) THEN
    CREATE POLICY parcel_proofs_staff_upload ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'parcel-proofs' AND public.current_role_code() IN ('super_admin', 'hub_manager', 'delivery_personnel'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'parcel_proofs_authorized_read'
  ) THEN
    CREATE POLICY parcel_proofs_authorized_read ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'parcel-proofs' AND public.current_role_code() IN ('super_admin', 'hub_manager', 'society_admin', 'delivery_personnel'));
  END IF;
END;
$$;
