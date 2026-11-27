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
-- PARCELBRIDGE: Row Level Security (RLS) Policies (Hardened)
-- Migration: 202611250002_rls_policies.sql
-- Note: Safe for fresh execution after 0001. Uses DROP POLICY IF EXISTS / CREATE OR REPLACE for idempotency.

-- ============================================================================
-- 1. SECURITY DEFINER Helper Functions (Explicit safe search_path, restricted exec)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_role_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role_code FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_society_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT society_id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Only super_admin has platform-wide (cross-society) administrative access
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_role_code() = 'super_admin', FALSE);
$$;

-- Both society_admin and hub_manager are strictly scoped to their assigned society_id
CREATE OR REPLACE FUNCTION public.is_society_staff_of(target_society_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.current_role_code() IN ('society_admin', 'hub_manager')
    AND public.current_society_id() IS NOT NULL
    AND public.current_society_id() = target_society_id,
    FALSE
  );
$$;

-- Breaks RLS recursion between parcels <-> delivery_assignments
CREATE OR REPLACE FUNCTION public.is_driver_assigned_to_parcel(target_parcel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_assignments da
    JOIN public.delivery_personnel dp ON dp.id = da.personnel_id
    WHERE da.parcel_id = target_parcel_id
      AND dp.profile_id = public.current_profile_id()
      AND da.status IN ('assigned', 'in_progress', 'completed')
  );
$$;

-- Restrict helper function execution to authenticated & service_role only
REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_role_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_society_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_society_staff_of(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_driver_assigned_to_parcel(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_role_code() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_society_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_society_staff_of(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_driver_assigned_to_parcel(UUID) TO authenticated, service_role;

-- ============================================================================
-- 2. Defense-in-Depth Triggers (SECURITY INVOKER)
-- ============================================================================

-- 2.1 Prevent Profile Privilege & Tenant Escalation
-- Only full_name, phone, flat_number, and avatar_url may be updated by non-super_admin users.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Authorized backend service_role client
  IF auth.role() = 'service_role' OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 2. Trusted direct DB maintenance (SQL Editor / migrations) with no PostgREST JWT context
  IF session_user IN ('postgres', 'supabase_admin')
     AND current_user IN ('postgres', 'supabase_admin')
     AND NULLIF(current_setting('request.jwt.claims', TRUE), '') IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Authenticated super_admin user
  IF auth.role() = 'authenticated' AND public.current_role_code() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  -- Block changes to identity, credentials, role, tenant/unit association, and lifecycle flags
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.role_code IS DISTINCT FROM OLD.role_code
     OR NEW.society_id IS DISTINCT FROM OLD.society_id
     OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'FORBIDDEN_PRIVILEGE_ESCALATION: Only super_admin may modify privileged or tenant profile fields';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2.2 Restrict Delivery Personnel Assignment Updates to Safe Delivery Fields
CREATE OR REPLACE FUNCTION public.enforce_driver_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF session_user IN ('postgres', 'supabase_admin')
     AND current_user IN ('postgres', 'supabase_admin')
     AND NULLIF(current_setting('request.jwt.claims', TRUE), '') IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'authenticated' AND public.current_role_code() IN ('super_admin', 'society_admin', 'hub_manager') THEN
    RETURN NEW;
  END IF;

  -- Drivers may only update status, failure_reason, completed_at (preserving parcel_id, personnel_id, booking_id)
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.parcel_id IS DISTINCT FROM OLD.parcel_id
     OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
     OR NEW.personnel_id IS DISTINCT FROM OLD.personnel_id
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.route_sequence IS DISTINCT FROM OLD.route_sequence
     OR NEW.is_demo IS DISTINCT FROM OLD.is_demo
     OR NEW.status NOT IN ('in_progress', 'completed', 'failed') THEN
    RAISE EXCEPTION 'FORBIDDEN_ASSIGNMENT_TAMPERING: Drivers may only update delivery status fields';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_driver_assignment_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_driver_assignment_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_driver_assignment_update ON public.delivery_assignments;
CREATE TRIGGER trg_enforce_driver_assignment_update
  BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_assignment_update();

-- ============================================================================
-- 3. Enable RLS on All 18 Application Tables
-- ============================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residential_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Table Policies & Column-Level Privileges
-- ============================================================================

-- 4.1 Roles: Authenticated read-only; no client writes allowed
DROP POLICY IF EXISTS roles_authenticated_read ON public.roles;
CREATE POLICY roles_authenticated_read ON public.roles
  FOR SELECT TO authenticated
  USING (TRUE);

-- 4.2 Profiles: Self read/update (non-privileged fields); society staff scoped to own society; super_admin full
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = public.current_profile_id()
    OR public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  );

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = public.current_profile_id())
  WITH CHECK (
    id = public.current_profile_id()
    AND auth_user_id = auth.uid()
    AND role_code = public.current_role_code()
    AND society_id IS NOT DISTINCT FROM public.current_society_id()
    AND is_active = TRUE
  );

DROP POLICY IF EXISTS profiles_super_admin_all ON public.profiles;
CREATE POLICY profiles_super_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4.3 Societies: Authenticated read active; super_admin manages all; society staff updates own society only
DROP POLICY IF EXISTS societies_read ON public.societies;
CREATE POLICY societies_read ON public.societies
  FOR SELECT TO authenticated
  USING (
    is_active = TRUE
    OR public.is_super_admin()
    OR public.is_society_staff_of(id)
  );

DROP POLICY IF EXISTS societies_super_admin_write ON public.societies;
CREATE POLICY societies_super_admin_write ON public.societies
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS societies_society_admin_update ON public.societies;
CREATE POLICY societies_society_admin_update ON public.societies
  FOR UPDATE TO authenticated
  USING (public.is_society_staff_of(id))
  WITH CHECK (public.is_society_staff_of(id));

-- 4.4 Residential Units: Residents/staff read own society; society staff manages own society; super_admin all
DROP POLICY IF EXISTS residential_units_select ON public.residential_units;
CREATE POLICY residential_units_select ON public.residential_units
  FOR SELECT TO authenticated
  USING (
    society_id = public.current_society_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS residential_units_admin_write ON public.residential_units;
CREATE POLICY residential_units_admin_write ON public.residential_units
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  );

-- 4.5 Parcel Hubs: Authenticated read active; super_admin & scoped society staff manage
DROP POLICY IF EXISTS hubs_read ON public.parcel_hubs;
CREATE POLICY hubs_read ON public.parcel_hubs
  FOR SELECT TO authenticated
  USING (
    is_active = TRUE
    OR public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  );

DROP POLICY IF EXISTS hubs_admin_write ON public.parcel_hubs;
CREATE POLICY hubs_admin_write ON public.parcel_hubs
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  );

-- 4.6 Parcels: Customer own only; delivery_personnel assigned only; society staff own society; super_admin all
DROP POLICY IF EXISTS parcels_customer_select ON public.parcels;
CREATE POLICY parcels_customer_select ON public.parcels
  FOR SELECT TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_super_admin()
    OR public.is_society_staff_of(society_id)
    OR public.is_driver_assigned_to_parcel(id)
  );

DROP POLICY IF EXISTS parcels_admin_write ON public.parcels;
CREATE POLICY parcels_admin_write ON public.parcels
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  );

-- 4.7 Parcel Events: Follow parcel visibility
DROP POLICY IF EXISTS parcel_events_select ON public.parcel_events;
CREATE POLICY parcel_events_select ON public.parcel_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = parcel_events.parcel_id
        AND (
          p.customer_id = public.current_profile_id()
          OR public.is_super_admin()
          OR public.is_society_staff_of(p.society_id)
          OR public.is_driver_assigned_to_parcel(p.id)
        )
    )
  );

DROP POLICY IF EXISTS parcel_events_admin_insert ON public.parcel_events;
CREATE POLICY parcel_events_admin_insert ON public.parcel_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = parcel_events.parcel_id
        AND (public.is_super_admin() OR public.is_society_staff_of(p.society_id))
    )
  );

-- 4.8 Delivery Slots: Authenticated read active; super_admin & scoped society staff write
DROP POLICY IF EXISTS delivery_slots_select ON public.delivery_slots;
CREATE POLICY delivery_slots_select ON public.delivery_slots
  FOR SELECT TO authenticated
  USING (
    is_active = TRUE
    OR public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  );

DROP POLICY IF EXISTS delivery_slots_admin_write ON public.delivery_slots;
CREATE POLICY delivery_slots_admin_write ON public.delivery_slots
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_society_staff_of(society_id)
  );

-- 4.9 Delivery Bookings: Customer owns booking AND referenced parcel; society staff scoped via parcel society
DROP POLICY IF EXISTS delivery_bookings_select ON public.delivery_bookings;
CREATE POLICY delivery_bookings_select ON public.delivery_bookings
  FOR SELECT TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_bookings_insert ON public.delivery_bookings;
CREATE POLICY delivery_bookings_insert ON public.delivery_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      customer_id = public.current_profile_id()
      AND EXISTS (
        SELECT 1 FROM public.parcels p
        WHERE p.id = delivery_bookings.parcel_id
          AND p.customer_id = public.current_profile_id()
      )
    )
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_bookings_update ON public.delivery_bookings;
CREATE POLICY delivery_bookings_update ON public.delivery_bookings
  FOR UPDATE TO authenticated
  USING (
    (
      customer_id = public.current_profile_id()
      AND EXISTS (
        SELECT 1 FROM public.parcels p
        WHERE p.id = delivery_bookings.parcel_id
          AND p.customer_id = public.current_profile_id()
      )
    )
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  )
  WITH CHECK (
    (
      customer_id = public.current_profile_id()
      AND EXISTS (
        SELECT 1 FROM public.parcels p
        WHERE p.id = delivery_bookings.parcel_id
          AND p.customer_id = public.current_profile_id()
      )
    )
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

-- 4.10 Delivery Personnel: Self read; super_admin all; society staff scoped by hub society
DROP POLICY IF EXISTS delivery_personnel_select ON public.delivery_personnel;
CREATE POLICY delivery_personnel_select ON public.delivery_personnel
  FOR SELECT TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcel_hubs ph
      WHERE ph.id = delivery_personnel.hub_id
        AND public.is_society_staff_of(ph.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_personnel_admin_write ON public.delivery_personnel;
CREATE POLICY delivery_personnel_admin_write ON public.delivery_personnel
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcel_hubs ph
      WHERE ph.id = delivery_personnel.hub_id
        AND public.is_society_staff_of(ph.society_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcel_hubs ph
      WHERE ph.id = delivery_personnel.hub_id
        AND public.is_society_staff_of(ph.society_id)
    )
  );

-- 4.11 Delivery Assignments: Assigned driver read + safe status update; super_admin & scoped society staff manage
DROP POLICY IF EXISTS delivery_assignments_select ON public.delivery_assignments;
CREATE POLICY delivery_assignments_select ON public.delivery_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.delivery_personnel dp
      WHERE dp.id = delivery_assignments.personnel_id
        AND dp.profile_id = public.current_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_assignments.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_assignments_driver_update ON public.delivery_assignments;
CREATE POLICY delivery_assignments_driver_update ON public.delivery_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_personnel dp
      WHERE dp.id = delivery_assignments.personnel_id
        AND dp.profile_id = public.current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_personnel dp
      WHERE dp.id = delivery_assignments.personnel_id
        AND dp.profile_id = public.current_profile_id()
    )
    AND status IN ('in_progress', 'completed', 'failed')
  );

DROP POLICY IF EXISTS delivery_assignments_admin_write ON public.delivery_assignments;
CREATE POLICY delivery_assignments_admin_write ON public.delivery_assignments
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_assignments.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_assignments.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

-- 4.12 OTP Verifications: NEVER accessible to ordinary clients via PostgREST (server service_role only)
DROP POLICY IF EXISTS otp_no_client_access ON public.otp_verifications;
CREATE POLICY otp_no_client_access ON public.otp_verifications
  FOR ALL TO authenticated, anon
  USING (FALSE)
  WITH CHECK (FALSE);

-- 4.13 Notifications: Column-level grant restricts authenticated users to updating ONLY is_read
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

DROP POLICY IF EXISTS notifications_recipient_select ON public.notifications;
CREATE POLICY notifications_recipient_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    recipient_id = public.current_profile_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS notifications_recipient_update ON public.notifications;
CREATE POLICY notifications_recipient_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = public.current_profile_id())
  WITH CHECK (recipient_id = public.current_profile_id());

DROP POLICY IF EXISTS notifications_super_admin_all ON public.notifications;
CREATE POLICY notifications_super_admin_all ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4.14 Courier Partners: Contains webhook_secret_hash & api_key_prefix -> super_admin only
DROP POLICY IF EXISTS courier_partners_admin_only ON public.courier_partners;
CREATE POLICY courier_partners_admin_only ON public.courier_partners
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4.15 Business Partners: Owner reads/submits own enquiry; super_admin manages all
DROP POLICY IF EXISTS business_partners_select ON public.business_partners;
CREATE POLICY business_partners_select ON public.business_partners
  FOR SELECT TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS business_partners_insert ON public.business_partners;
CREATE POLICY business_partners_insert ON public.business_partners
  FOR INSERT TO authenticated
  WITH CHECK (
    (profile_id = public.current_profile_id() AND status = 'pending')
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS business_partners_super_admin_update ON public.business_partners;
CREATE POLICY business_partners_super_admin_update ON public.business_partners
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4.16 Return Requests: Customer owns request AND referenced parcel; society staff scoped via parcel society
DROP POLICY IF EXISTS return_requests_owner ON public.return_requests;
CREATE POLICY return_requests_owner ON public.return_requests
  FOR ALL TO authenticated
  USING (
    (
      customer_id = public.current_profile_id()
      AND EXISTS (
        SELECT 1 FROM public.parcels p
        WHERE p.id = return_requests.parcel_id
          AND p.customer_id = public.current_profile_id()
      )
    )
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  )
  WITH CHECK (
    (
      customer_id = public.current_profile_id()
      AND EXISTS (
        SELECT 1 FROM public.parcels p
        WHERE p.id = return_requests.parcel_id
          AND p.customer_id = public.current_profile_id()
      )
    )
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

-- 4.17 Support Tickets: Customer owns ticket; society staff scoped to customer's society; super_admin all
DROP POLICY IF EXISTS support_tickets_owner ON public.support_tickets;
CREATE POLICY support_tickets_owner ON public.support_tickets
  FOR ALL TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = support_tickets.customer_id
        AND public.is_society_staff_of(pr.society_id)
    )
  )
  WITH CHECK (
    customer_id = public.current_profile_id()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = support_tickets.customer_id
        AND public.is_society_staff_of(pr.society_id)
    )
  );

-- 4.18 Audit Logs: super_admin read only; no client insert/update/delete
DROP POLICY IF EXISTS audit_logs_super_admin ON public.audit_logs;
CREATE POLICY audit_logs_super_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
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
