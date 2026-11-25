-- PARCELBRIDGE: Initial Normalized PostgreSQL Schema
-- Migration: 202611250001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Roles
CREATE TABLE IF NOT EXISTS public.roles (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code IN (
    'super_admin',
    'society_admin',
    'hub_manager',
    'delivery_personnel',
    'customer',
    'business_partner'
  )),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.roles (code, name, description) VALUES
  ('super_admin', 'Super Administrator', 'Full platform governance across all societies, hubs, users, and partners'),
  ('society_admin', 'Residential Society Administrator', 'Manages residential units, society hubs, and resident parcels'),
  ('hub_manager', 'Parcel Hub Manager', 'Manages hub intake, QR scanning, storage racks, and dispatch'),
  ('delivery_personnel', 'Delivery Personnel', 'Executes assigned last-mile deliveries and OTP handovers'),
  ('customer', 'Registered Customer', 'Tracks incoming parcels, books delivery slots, and confirms OTP'),
  ('business_partner', 'Business/Logistics Partner', 'Submits partnership applications and accesses partner webhook APIs')
ON CONFLICT (code) DO NOTHING;

-- 2. Societies
CREATE TABLE IF NOT EXISTS public.societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  total_units INTEGER NOT NULL DEFAULT 0 CHECK (total_units >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Residential Units
CREATE TABLE IF NOT EXISTS public.residential_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  tower_block TEXT,
  unit_number TEXT NOT NULL,
  floor_number INTEGER,
  is_occupied BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (society_id, tower_block, unit_number)
);

-- 4. Parcel Hubs
CREATE TABLE IF NOT EXISTS public.parcel_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location_description TEXT,
  capacity INTEGER NOT NULL DEFAULT 500 CHECK (capacity > 0),
  current_occupancy INTEGER NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
  operating_hours TEXT NOT NULL DEFAULT '07:00 - 22:00',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Profiles (Linked to auth.users or standalone app auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  role_code TEXT NOT NULL DEFAULT 'customer' REFERENCES public.roles(code),
  society_id UUID REFERENCES public.societies(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.residential_units(id) ON DELETE SET NULL,
  flat_number TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Courier Partners
CREATE TABLE IF NOT EXISTS public.courier_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  integration_status TEXT NOT NULL DEFAULT 'planned' CHECK (integration_status IN ('planned', 'sandbox', 'active', 'paused')),
  webhook_endpoint TEXT,
  webhook_secret_hash TEXT,
  api_key_prefix TEXT,
  supported_regions TEXT[] DEFAULT ARRAY['India'],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Business Partners (Partnership Enquiries & Portal Accounts)
CREATE TABLE IF NOT EXISTS public.business_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  partner_type TEXT NOT NULL CHECK (partner_type IN (
    'ecommerce',
    'courier',
    'logistics_operator',
    'property_management',
    'residential_society'
  )),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  website_url TEXT,
  monthly_parcel_volume INTEGER DEFAULT 0 CHECK (monthly_parcel_volume >= 0),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'sandbox_enabled')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Delivery Personnel
CREATE TABLE IF NOT EXISTS public.delivery_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  hub_id UUID REFERENCES public.parcel_hubs(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'ev_scooter',
  shift_start TIME NOT NULL DEFAULT '08:00:00',
  shift_end TIME NOT NULL DEFAULT '20:00:00',
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  active_deliveries_count INTEGER NOT NULL DEFAULT 0 CHECK (active_deliveries_count >= 0),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Parcels
CREATE TABLE IF NOT EXISTS public.parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_parcel_code TEXT NOT NULL UNIQUE,
  external_tracking_id TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  unit_id UUID REFERENCES public.residential_units(id) ON DELETE SET NULL,
  hub_id UUID NOT NULL REFERENCES public.parcel_hubs(id) ON DELETE RESTRICT,
  courier_partner_id UUID REFERENCES public.courier_partners(id) ON DELETE SET NULL,
  courier_name TEXT NOT NULL,
  ecommerce_platform TEXT,
  description TEXT NOT NULL,
  weight_kg NUMERIC(6,2) CHECK (weight_kg >= 0),
  storage_location TEXT,
  qr_token TEXT NOT NULL UNIQUE,
  current_status TEXT NOT NULL DEFAULT 'Expected' CHECK (current_status IN (
    'Expected',
    'Received at hub',
    'Scanned',
    'Verified',
    'Stored',
    'Ready for delivery',
    'Delivery scheduled',
    'Out for delivery',
    'Delivered',
    'Delivery attempted',
    'Returned',
    'Cancelled'
  )),
  arrived_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Parcel Events (Immutable Lifecycle Audit Trail)
CREATE TABLE IF NOT EXISTS public.parcel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  location TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Delivery Slots
CREATE TABLE IF NOT EXISTS public.delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID NOT NULL REFERENCES public.parcel_hubs(id) ON DELETE CASCADE,
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0 AND booked_count <= max_capacity),
  staff_available INTEGER NOT NULL DEFAULT 1 CHECK (staff_available >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time),
  UNIQUE (hub_id, society_id, slot_date, start_time, end_time)
);

-- 12. Delivery Bookings
CREATE TABLE IF NOT EXISTS public.delivery_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  slot_id UUID NOT NULL REFERENCES public.delivery_slots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'rescheduled', 'cancelled', 'completed', 'failed')),
  delivery_instructions TEXT,
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active confirmed booking per parcel at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_booking_per_parcel
  ON public.delivery_bookings(parcel_id)
  WHERE status = 'confirmed';

-- 13. Delivery Assignments
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.delivery_bookings(id) ON DELETE SET NULL,
  personnel_id UUID NOT NULL REFERENCES public.delivery_personnel(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  route_sequence INTEGER NOT NULL DEFAULT 1,
  route_notes TEXT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'failed', 'reassigned')),
  failure_reason TEXT,
  completed_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. OTP Verifications (Hashed OTPs only)
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_invalidated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parcel_id UUID REFERENCES public.parcels(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'parcel_update' CHECK (category IN ('parcel_update', 'slot_reminder', 'otp_alert', 'system', 'support')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Return Requests
CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  pickup_slot_date DATE,
  pickup_window TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'pickup_scheduled', 'picked_up', 'returned_to_courier', 'rejected')),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  parcel_id UUID REFERENCES public.parcels(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role_code);
CREATE INDEX IF NOT EXISTS idx_profiles_society ON public.profiles(society_id);
CREATE INDEX IF NOT EXISTS idx_parcels_customer ON public.parcels(customer_id);
CREATE INDEX IF NOT EXISTS idx_parcels_society ON public.parcels(society_id);
CREATE INDEX IF NOT EXISTS idx_parcels_hub ON public.parcels(hub_id);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON public.parcels(current_status);
CREATE INDEX IF NOT EXISTS idx_parcels_ext_tracking ON public.parcels(external_tracking_id);
CREATE INDEX IF NOT EXISTS idx_parcel_events_parcel ON public.parcel_events(parcel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_lookup ON public.delivery_slots(society_id, slot_date, is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_bookings_customer ON public.delivery_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_personnel ON public.delivery_assignments(personnel_id, status);
CREATE INDEX IF NOT EXISTS idx_otp_parcel_active ON public.otp_verifications(parcel_id) WHERE is_invalidated = FALSE AND verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id, created_at DESC);
