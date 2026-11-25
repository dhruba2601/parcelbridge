-- PARCELBRIDGE: Row Level Security (RLS) Policies
-- Migration: 202611250002_rls_policies.sql

-- Helper functions for Supabase Auth JWT context
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_role_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role_code FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(public.current_role_code() IN ('super_admin', 'hub_manager', 'society_admin'), FALSE);
$$;

-- Enable RLS on all sensitive tables
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

-- Profiles: users read/update own profile; admins read all
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT USING (id = public.current_profile_id() OR public.is_platform_admin());

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE USING (id = public.current_profile_id() OR public.current_role_code() = 'super_admin');

-- Societies & Hubs: readable by authenticated users for selection; managed by admins
CREATE POLICY societies_read ON public.societies
  FOR SELECT USING (is_active = TRUE OR public.is_platform_admin());

CREATE POLICY societies_admin_write ON public.societies
  FOR ALL USING (public.current_role_code() IN ('super_admin', 'society_admin'));

CREATE POLICY hubs_read ON public.parcel_hubs
  FOR SELECT USING (is_active = TRUE OR public.is_platform_admin());

CREATE POLICY hubs_admin_write ON public.parcel_hubs
  FOR ALL USING (public.current_role_code() IN ('super_admin', 'hub_manager'));

-- Parcels: customers only see their own; delivery personnel only assigned; admins/hub managers see all
CREATE POLICY parcels_customer_select ON public.parcels
  FOR SELECT USING (
    customer_id = public.current_profile_id()
    OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      JOIN public.delivery_personnel dp ON dp.id = da.personnel_id
      WHERE da.parcel_id = parcels.id AND dp.profile_id = public.current_profile_id()
    )
  );

CREATE POLICY parcels_admin_write ON public.parcels
  FOR ALL USING (public.is_platform_admin());

-- Parcel events: follow parcel visibility
CREATE POLICY parcel_events_select ON public.parcel_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = parcel_events.parcel_id
        AND (p.customer_id = public.current_profile_id() OR public.is_platform_admin())
    )
  );

-- Delivery slots: readable by authenticated users, writable by admins/hub managers
CREATE POLICY delivery_slots_select ON public.delivery_slots
  FOR SELECT USING (is_active = TRUE OR public.is_platform_admin());

CREATE POLICY delivery_slots_admin_write ON public.delivery_slots
  FOR ALL USING (public.is_platform_admin());

-- Delivery bookings: customers manage own bookings; admins see all
CREATE POLICY delivery_bookings_select ON public.delivery_bookings
  FOR SELECT USING (customer_id = public.current_profile_id() OR public.is_platform_admin());

CREATE POLICY delivery_bookings_insert ON public.delivery_bookings
  FOR INSERT WITH CHECK (customer_id = public.current_profile_id() OR public.is_platform_admin());

CREATE POLICY delivery_bookings_update ON public.delivery_bookings
  FOR UPDATE USING (customer_id = public.current_profile_id() OR public.is_platform_admin());

-- Delivery assignments: only assigned staff or admins
CREATE POLICY delivery_assignments_select ON public.delivery_assignments
  FOR SELECT USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.delivery_personnel dp
      WHERE dp.id = delivery_assignments.personnel_id AND dp.profile_id = public.current_profile_id()
    )
  );

-- OTP verifications: NEVER directly readable by clients via PostgREST (only server service-role)
CREATE POLICY otp_no_client_access ON public.otp_verifications
  FOR ALL USING (FALSE);

-- Notifications: recipient only
CREATE POLICY notifications_recipient ON public.notifications
  FOR ALL USING (recipient_id = public.current_profile_id() OR public.current_role_code() = 'super_admin');

-- Return requests & Support tickets: customer owner or admin
CREATE POLICY return_requests_owner ON public.return_requests
  FOR ALL USING (customer_id = public.current_profile_id() OR public.is_platform_admin());

CREATE POLICY support_tickets_owner ON public.support_tickets
  FOR ALL USING (customer_id = public.current_profile_id() OR public.is_platform_admin());

-- Business partners: owner or super_admin
CREATE POLICY business_partners_select ON public.business_partners
  FOR SELECT USING (profile_id = public.current_profile_id() OR public.current_role_code() = 'super_admin');

-- Audit logs: super_admin only
CREATE POLICY audit_logs_super_admin ON public.audit_logs
  FOR SELECT USING (public.current_role_code() = 'super_admin');
