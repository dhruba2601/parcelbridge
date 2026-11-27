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

CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_role_code() IN ('super_admin', 'hub_manager'), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_society_admin_of(target_society_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.current_role_code() = 'society_admin'
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
REVOKE ALL ON FUNCTION public.is_global_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_society_admin_of(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_driver_assigned_to_parcel(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_role_code() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_society_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_global_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_society_admin_of(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_driver_assigned_to_parcel(UUID) TO authenticated, service_role;

-- ============================================================================
-- 2. Defense-in-Depth Trigger: Prevent Profile Privilege Escalation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Backend service_role, DB admin roles, and super_admin may update privileged columns
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR auth.role() = 'service_role'
     OR public.current_role_code() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.role_code IS DISTINCT FROM OLD.role_code
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'FORBIDDEN_PRIVILEGE_ESCALATION: Only super_admin may modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

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
-- 4. Table Policies (Explicit TO authenticated, WITH CHECK, Society-Scoped)
-- ============================================================================

-- 4.1 Roles: Authenticated users may read role definitions; no client writes allowed
DROP POLICY IF EXISTS roles_authenticated_read ON public.roles;
CREATE POLICY roles_authenticated_read ON public.roles
  FOR SELECT TO authenticated
  USING (TRUE);

-- 4.2 Profiles: Self read/update (non-privileged fields); society_admin scoped to own society; super_admin full
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = public.current_profile_id()
    OR public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  );

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = public.current_profile_id())
  WITH CHECK (
    id = public.current_profile_id()
    AND auth_user_id = auth.uid()
    AND role_code = public.current_role_code()
    AND is_active = TRUE
  );

DROP POLICY IF EXISTS profiles_super_admin_all ON public.profiles;
CREATE POLICY profiles_super_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.current_role_code() = 'super_admin')
  WITH CHECK (public.current_role_code() = 'super_admin');

-- 4.3 Societies: Authenticated read active; super_admin manages all; society_admin updates own society only
DROP POLICY IF EXISTS societies_read ON public.societies;
CREATE POLICY societies_read ON public.societies
  FOR SELECT TO authenticated
  USING (
    is_active = TRUE
    OR public.is_global_admin()
    OR public.is_society_admin_of(id)
  );

DROP POLICY IF EXISTS societies_super_admin_write ON public.societies;
CREATE POLICY societies_super_admin_write ON public.societies
  FOR ALL TO authenticated
  USING (public.current_role_code() = 'super_admin')
  WITH CHECK (public.current_role_code() = 'super_admin');

DROP POLICY IF EXISTS societies_society_admin_update ON public.societies;
CREATE POLICY societies_society_admin_update ON public.societies
  FOR UPDATE TO authenticated
  USING (public.is_society_admin_of(id))
  WITH CHECK (public.is_society_admin_of(id));

-- 4.4 Residential Units: Residents/staff read own society; society_admin manages own society; global admin all
DROP POLICY IF EXISTS residential_units_select ON public.residential_units;
CREATE POLICY residential_units_select ON public.residential_units
  FOR SELECT TO authenticated
  USING (
    society_id = public.current_society_id()
    OR public.is_global_admin()
  );

DROP POLICY IF EXISTS residential_units_admin_write ON public.residential_units;
CREATE POLICY residential_units_admin_write ON public.residential_units
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  )
  WITH CHECK (
    public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  );

-- 4.5 Parcel Hubs: Authenticated read active; global admin & scoped society_admin manage
DROP POLICY IF EXISTS hubs_read ON public.parcel_hubs;
CREATE POLICY hubs_read ON public.parcel_hubs
  FOR SELECT TO authenticated
  USING (
    is_active = TRUE
    OR public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  );

DROP POLICY IF EXISTS hubs_admin_write ON public.parcel_hubs;
CREATE POLICY hubs_admin_write ON public.parcel_hubs
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  )
  WITH CHECK (
    public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  );

-- 4.6 Parcels: Customer own only; delivery_personnel assigned only; society_admin own society; global admin all
DROP POLICY IF EXISTS parcels_customer_select ON public.parcels;
CREATE POLICY parcels_customer_select ON public.parcels
  FOR SELECT TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR public.is_society_admin_of(society_id)
    OR public.is_driver_assigned_to_parcel(id)
  );

DROP POLICY IF EXISTS parcels_admin_write ON public.parcels;
CREATE POLICY parcels_admin_write ON public.parcels
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  )
  WITH CHECK (
    public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  );

-- 4.7 Parcel Events: Follow parcel visibility (customer, scoped society_admin, assigned driver, global admin)
DROP POLICY IF EXISTS parcel_events_select ON public.parcel_events;
CREATE POLICY parcel_events_select ON public.parcel_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = parcel_events.parcel_id
        AND (
          p.customer_id = public.current_profile_id()
          OR public.is_global_admin()
          OR public.is_society_admin_of(p.society_id)
          OR EXISTS (
            SELECT 1 FROM public.delivery_assignments da
            JOIN public.delivery_personnel dp ON dp.id = da.personnel_id
            WHERE da.parcel_id = p.id AND dp.profile_id = public.current_profile_id()
          )
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
        AND (public.is_global_admin() OR public.is_society_admin_of(p.society_id))
    )
  );

-- 4.8 Delivery Slots: Authenticated read active; global admin & scoped society_admin write
DROP POLICY IF EXISTS delivery_slots_select ON public.delivery_slots;
CREATE POLICY delivery_slots_select ON public.delivery_slots
  FOR SELECT TO authenticated
  USING (
    is_active = TRUE
    OR public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  );

DROP POLICY IF EXISTS delivery_slots_admin_write ON public.delivery_slots;
CREATE POLICY delivery_slots_admin_write ON public.delivery_slots
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  )
  WITH CHECK (
    public.is_global_admin()
    OR public.is_society_admin_of(society_id)
  );

-- 4.9 Delivery Bookings: Customer owns booking; society_admin scoped via parcel society; global admin all
DROP POLICY IF EXISTS delivery_bookings_select ON public.delivery_bookings;
CREATE POLICY delivery_bookings_select ON public.delivery_bookings
  FOR SELECT TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_bookings_insert ON public.delivery_bookings;
CREATE POLICY delivery_bookings_insert ON public.delivery_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_bookings_update ON public.delivery_bookings;
CREATE POLICY delivery_bookings_update ON public.delivery_bookings
  FOR UPDATE TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  )
  WITH CHECK (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_bookings.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  );

-- 4.10 Delivery Personnel: Self read; global admin all; society_admin scoped by hub society
DROP POLICY IF EXISTS delivery_personnel_select ON public.delivery_personnel;
CREATE POLICY delivery_personnel_select ON public.delivery_personnel
  FOR SELECT TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcel_hubs ph
      WHERE ph.id = delivery_personnel.hub_id
        AND public.is_society_admin_of(ph.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_personnel_admin_write ON public.delivery_personnel;
CREATE POLICY delivery_personnel_admin_write ON public.delivery_personnel
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcel_hubs ph
      WHERE ph.id = delivery_personnel.hub_id
        AND public.is_society_admin_of(ph.society_id)
    )
  )
  WITH CHECK (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcel_hubs ph
      WHERE ph.id = delivery_personnel.hub_id
        AND public.is_society_admin_of(ph.society_id)
    )
  );

-- 4.11 Delivery Assignments: Assigned driver read/update status; global admin & scoped society_admin manage
DROP POLICY IF EXISTS delivery_assignments_select ON public.delivery_assignments;
CREATE POLICY delivery_assignments_select ON public.delivery_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.delivery_personnel dp
      WHERE dp.id = delivery_assignments.personnel_id
        AND dp.profile_id = public.current_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_assignments.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  );

DROP POLICY IF EXISTS delivery_assignments_admin_write ON public.delivery_assignments;
CREATE POLICY delivery_assignments_admin_write ON public.delivery_assignments
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_assignments.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  )
  WITH CHECK (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = delivery_assignments.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  );

-- 4.12 OTP Verifications: NEVER accessible to ordinary clients via PostgREST (server service_role only)
DROP POLICY IF EXISTS otp_no_client_access ON public.otp_verifications;
CREATE POLICY otp_no_client_access ON public.otp_verifications
  FOR ALL TO authenticated, anon
  USING (FALSE)
  WITH CHECK (FALSE);

-- 4.13 Notifications: Recipient may read & mark read; only super_admin/service_role may insert/delete
DROP POLICY IF EXISTS notifications_recipient_select ON public.notifications;
CREATE POLICY notifications_recipient_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    recipient_id = public.current_profile_id()
    OR public.current_role_code() = 'super_admin'
  );

DROP POLICY IF EXISTS notifications_recipient_update ON public.notifications;
CREATE POLICY notifications_recipient_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = public.current_profile_id())
  WITH CHECK (recipient_id = public.current_profile_id());

DROP POLICY IF EXISTS notifications_super_admin_all ON public.notifications;
CREATE POLICY notifications_super_admin_all ON public.notifications
  FOR ALL TO authenticated
  USING (public.current_role_code() = 'super_admin')
  WITH CHECK (public.current_role_code() = 'super_admin');

-- 4.14 Courier Partners: Contains webhook_secret_hash & api_key_prefix -> global admins only
DROP POLICY IF EXISTS courier_partners_admin_only ON public.courier_partners;
CREATE POLICY courier_partners_admin_only ON public.courier_partners
  FOR ALL TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

-- 4.15 Business Partners: Owner reads/submits own enquiry; super_admin manages all
DROP POLICY IF EXISTS business_partners_select ON public.business_partners;
CREATE POLICY business_partners_select ON public.business_partners
  FOR SELECT TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.current_role_code() = 'super_admin'
  );

DROP POLICY IF EXISTS business_partners_insert ON public.business_partners;
CREATE POLICY business_partners_insert ON public.business_partners
  FOR INSERT TO authenticated
  WITH CHECK (
    (profile_id = public.current_profile_id() AND status = 'pending')
    OR public.current_role_code() = 'super_admin'
  );

DROP POLICY IF EXISTS business_partners_super_admin_update ON public.business_partners;
CREATE POLICY business_partners_super_admin_update ON public.business_partners
  FOR UPDATE TO authenticated
  USING (public.current_role_code() = 'super_admin')
  WITH CHECK (public.current_role_code() = 'super_admin');

-- 4.16 Return Requests: Customer owns request; society_admin scoped via parcel society; global admin all
DROP POLICY IF EXISTS return_requests_owner ON public.return_requests;
CREATE POLICY return_requests_owner ON public.return_requests
  FOR ALL TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  )
  WITH CHECK (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = return_requests.parcel_id
        AND public.is_society_admin_of(p.society_id)
    )
  );

-- 4.17 Support Tickets: Customer owns ticket; society_admin scoped to customer's society; global admin all
DROP POLICY IF EXISTS support_tickets_owner ON public.support_tickets;
CREATE POLICY support_tickets_owner ON public.support_tickets
  FOR ALL TO authenticated
  USING (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = support_tickets.customer_id
        AND public.is_society_admin_of(pr.society_id)
    )
  )
  WITH CHECK (
    customer_id = public.current_profile_id()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = support_tickets.customer_id
        AND public.is_society_admin_of(pr.society_id)
    )
  );

-- 4.18 Audit Logs: super_admin read only; no client insert/update/delete
DROP POLICY IF EXISTS audit_logs_super_admin ON public.audit_logs;
CREATE POLICY audit_logs_super_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.current_role_code() = 'super_admin');
