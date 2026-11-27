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
-- 2. Defense-in-Depth Triggers (SECURITY INVOKER, Genuine JSONB Allowlists)
-- ============================================================================

-- 2.1 Profile Complete Allowlist:
-- Ordinary users may ONLY modify: full_name, phone, flat_number, avatar_url, updated_at.
-- Every other column (including any future columns) is rejected via JSONB diff.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY['full_name', 'phone', 'flat_number', 'avatar_url', 'updated_at'];
BEGIN
  IF auth.role() = 'service_role' OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF session_user IN ('postgres', 'supabase_admin')
     AND current_user IN ('postgres', 'supabase_admin')
     AND NULLIF(current_setting('request.jwt.claims', TRUE), '') IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'authenticated' AND public.current_role_code() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed) THEN
    RAISE EXCEPTION 'FORBIDDEN_PRIVILEGE_ESCALATION: Only allowlisted profile columns (full_name, phone, flat_number, avatar_url) may be updated';
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

-- 2.2 Delivery Booking Customer Update Guard:
-- Customers may ONLY modify: delivery_instructions, updated_at.
CREATE OR REPLACE FUNCTION public.enforce_booking_customer_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY['delivery_instructions', 'updated_at'];
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

  IF (to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed) THEN
    RAISE EXCEPTION 'FORBIDDEN_BOOKING_TAMPERING: Customers may only update delivery_instructions';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_booking_customer_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_booking_customer_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_booking_customer_update ON public.delivery_bookings;
CREATE TRIGGER trg_enforce_booking_customer_update
  BEFORE UPDATE ON public.delivery_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_customer_update();

-- 2.3 Return Request Customer Update Guard:
-- Customers may ONLY modify: reason, pickup_slot_date, pickup_window, updated_at while status = 'requested'.
CREATE OR REPLACE FUNCTION public.enforce_return_request_customer_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY['reason', 'pickup_slot_date', 'pickup_window', 'updated_at'];
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

  IF OLD.status <> 'requested'
     OR (to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed) THEN
    RAISE EXCEPTION 'FORBIDDEN_RETURN_TAMPERING: Customers may only update reason, pickup_slot_date, or pickup_window while status is requested';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_return_request_customer_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_return_request_customer_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_return_request_customer_update ON public.return_requests;
CREATE TRIGGER trg_enforce_return_request_customer_update
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_return_request_customer_update();

-- 2.4 Support Ticket Customer Update Guard:
-- Customers may ONLY modify: subject, description, priority, updated_at.
CREATE OR REPLACE FUNCTION public.enforce_support_ticket_customer_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY['subject', 'description', 'priority', 'updated_at'];
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

  IF (to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed) THEN
    RAISE EXCEPTION 'FORBIDDEN_TICKET_TAMPERING: Customers may only update subject, description, or priority';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_support_ticket_customer_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_support_ticket_customer_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_support_ticket_customer_update ON public.support_tickets;
CREATE TRIGGER trg_enforce_support_ticket_customer_update
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_support_ticket_customer_update();

-- Remove obsolete direct-driver assignment trigger if present from earlier revision
DROP TRIGGER IF EXISTS trg_enforce_driver_assignment_update ON public.delivery_assignments;
DROP FUNCTION IF EXISTS public.enforce_driver_assignment_update();

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

-- 4.2 Profiles: Revoke broad SELECT from PUBLIC, anon, authenticated so password_hash,
-- auth_user_id, and email are NEVER directly selectable by clients. service_role retains full access.
REVOKE SELECT ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  full_name,
  phone,
  role_code,
  society_id,
  unit_id,
  flat_number,
  avatar_url,
  is_active,
  is_demo,
  created_at,
  updated_at
) ON public.profiles TO authenticated;

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

-- 4.9 Delivery Bookings:
-- Customers read own bookings and may only update delivery_instructions (protected by trigger).
-- Booking creation/rescheduling/cancellation must go through atomic RPCs (service_role) or scoped admin.
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
DROP POLICY IF EXISTS delivery_bookings_admin_insert ON public.delivery_bookings;
CREATE POLICY delivery_bookings_admin_insert ON public.delivery_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_bookings_update ON public.delivery_bookings;
DROP POLICY IF EXISTS delivery_bookings_customer_update ON public.delivery_bookings;
CREATE POLICY delivery_bookings_customer_update ON public.delivery_bookings
  FOR UPDATE TO authenticated
  USING (
    customer_id = public.current_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND p.customer_id = public.current_profile_id()
    )
  )
  WITH CHECK (
    customer_id = public.current_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND p.customer_id = public.current_profile_id()
    )
  );

DROP POLICY IF EXISTS delivery_bookings_admin_update ON public.delivery_bookings;
CREATE POLICY delivery_bookings_admin_update ON public.delivery_bookings
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
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

-- 4.11 Delivery Assignments:
-- Assigned drivers have READ-ONLY access. All assignment updates (including completion) must go
-- through the Express backend (service_role) after OTP verification, or scoped admin/super_admin.
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

-- 4.16 Return Requests: Split SELECT, INSERT, UPDATE (customers cannot approve or alter status/ownership)
DROP POLICY IF EXISTS return_requests_owner ON public.return_requests;
DROP POLICY IF EXISTS return_requests_select ON public.return_requests;
CREATE POLICY return_requests_select ON public.return_requests
  FOR SELECT TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

DROP POLICY IF EXISTS return_requests_customer_insert ON public.return_requests;
CREATE POLICY return_requests_customer_insert ON public.return_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = public.current_profile_id()
    AND status = 'requested'
    AND is_demo = FALSE
    AND EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND p.customer_id = public.current_profile_id()
    )
  );

DROP POLICY IF EXISTS return_requests_customer_update ON public.return_requests;
CREATE POLICY return_requests_customer_update ON public.return_requests
  FOR UPDATE TO authenticated
  USING (
    customer_id = public.current_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND p.customer_id = public.current_profile_id()
    )
  )
  WITH CHECK (
    customer_id = public.current_profile_id()
    AND status = 'requested'
    AND EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND p.customer_id = public.current_profile_id()
    )
  );

DROP POLICY IF EXISTS return_requests_admin_write ON public.return_requests;
CREATE POLICY return_requests_admin_write ON public.return_requests
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND public.is_society_staff_of(p.society_id)
    )
  );

-- 4.17 Support Tickets: Split SELECT, INSERT, UPDATE (customers cannot alter status, assigned_to, resolution_notes)
DROP POLICY IF EXISTS support_tickets_owner ON public.support_tickets;
DROP POLICY IF EXISTS support_tickets_select ON public.support_tickets;
CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = support_tickets.customer_id
        AND public.is_society_staff_of(pr.society_id)
    )
  );

DROP POLICY IF EXISTS support_tickets_customer_insert ON public.support_tickets;
CREATE POLICY support_tickets_customer_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = public.current_profile_id()
    AND status = 'open'
    AND assigned_to IS NULL
    AND resolution_notes IS NULL
    AND is_demo = FALSE
    AND (
      parcel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.parcels p
        WHERE p.id = support_tickets.parcel_id
          AND p.customer_id = public.current_profile_id()
      )
    )
  );

DROP POLICY IF EXISTS support_tickets_customer_update ON public.support_tickets;
CREATE POLICY support_tickets_customer_update ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (customer_id = public.current_profile_id())
  WITH CHECK (
    customer_id = public.current_profile_id()
    AND assigned_to IS NULL
    AND resolution_notes IS NULL
  );

DROP POLICY IF EXISTS support_tickets_admin_write ON public.support_tickets;
CREATE POLICY support_tickets_admin_write ON public.support_tickets
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = support_tickets.customer_id
        AND public.is_society_staff_of(pr.society_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
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

-- ============================================================================
-- 5. Post-Migration Privilege Verification
-- ============================================================================
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.profiles', 'SELECT')
     OR has_table_privilege('authenticated', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'PRIVILEGE_CHECK_FAILED: Table-level SELECT on public.profiles must be revoked from anon and authenticated';
  END IF;

  IF has_column_privilege('authenticated', 'public.profiles', 'password_hash', 'SELECT')
     OR has_column_privilege('authenticated', 'public.profiles', 'auth_user_id', 'SELECT')
     OR has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT') THEN
    RAISE EXCEPTION 'PRIVILEGE_CHECK_FAILED: Sensitive columns (password_hash, auth_user_id, email) must not be selectable by authenticated';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.profiles', 'full_name', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.profiles', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.profiles', 'password_hash', 'SELECT') THEN
    RAISE EXCEPTION 'PRIVILEGE_CHECK_FAILED: Expected safe authenticated column SELECT and full service_role SELECT missing';
  END IF;
END;
$$;
