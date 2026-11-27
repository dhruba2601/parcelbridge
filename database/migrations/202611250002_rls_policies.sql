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
