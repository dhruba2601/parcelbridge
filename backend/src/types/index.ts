export type UserRole =
  | 'super_admin'
  | 'society_admin'
  | 'hub_manager'
  | 'delivery_personnel'
  | 'customer'
  | 'business_partner';

export type ParcelStatus =
  | 'Expected'
  | 'Received at hub'
  | 'Scanned'
  | 'Verified'
  | 'Stored'
  | 'Ready for delivery'
  | 'Delivery scheduled'
  | 'Out for delivery'
  | 'Delivered'
  | 'Delivery attempted'
  | 'Returned'
  | 'Cancelled';

export interface Profile {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role_code: UserRole;
  society_id: string | null;
  unit_id: string | null;
  flat_number: string | null;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SafeProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role_code: UserRole;
  society_id: string | null;
  unit_id: string | null;
  flat_number: string | null;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface Society {
  id: string;
  name: string;
  code: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  timezone: string;
  total_units: number;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface ParcelHub {
  id: string;
  society_id: string | null;
  name: string;
  code: string;
  location_description: string | null;
  capacity: number;
  current_occupancy: number;
  operating_hours: string;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface Parcel {
  id: string;
  internal_parcel_code: string;
  external_tracking_id: string;
  customer_id: string;
  society_id: string;
  unit_id: string | null;
  hub_id: string;
  courier_name: string;
  ecommerce_platform: string | null;
  description: string;
  weight_kg: number | null;
  storage_location: string | null;
  qr_token: string;
  current_status: ParcelStatus;
  arrived_at: string | null;
  delivered_at: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParcelEvent {
  id: string;
  parcel_id: string;
  previous_status: ParcelStatus | null;
  new_status: ParcelStatus;
  actor_id: string | null;
  actor_role: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
}

export interface DeliverySlot {
  id: string;
  hub_id: string;
  society_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  max_capacity: number;
  booked_count: number;
  staff_available: number;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface DeliveryBooking {
  id: string;
  parcel_id: string;
  customer_id: string;
  slot_id: string;
  status: 'confirmed' | 'rescheduled' | 'cancelled' | 'completed' | 'failed';
  delivery_instructions: string | null;
  reschedule_count: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPersonnel {
  id: string;
  profile_id: string;
  hub_id: string | null;
  employee_code: string;
  vehicle_type: string;
  shift_start: string;
  shift_end: string;
  is_available: boolean;
  active_deliveries_count: number;
  is_demo: boolean;
}

export interface DeliveryAssignment {
  id: string;
  parcel_id: string;
  booking_id: string | null;
  personnel_id: string;
  assigned_by: string | null;
  route_sequence: number;
  route_notes: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed' | 'reassigned';
  failure_reason: string | null;
  completed_at: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface OtpVerification {
  id: string;
  parcel_id: string;
  customer_id: string;
  otp_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  verified_at: string | null;
  verified_by: string | null;
  is_invalidated: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  parcel_id: string | null;
  title: string;
  message: string;
  category: 'parcel_update' | 'slot_reminder' | 'otp_alert' | 'system' | 'support';
  is_read: boolean;
  created_at: string;
}

export interface ReturnRequest {
  id: string;
  parcel_id: string;
  customer_id: string;
  reason: string;
  pickup_slot_date: string | null;
  pickup_window: string | null;
  status: 'requested' | 'approved' | 'pickup_scheduled' | 'picked_up' | 'returned_to_courier' | 'rejected';
  is_demo: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  customer_id: string;
  parcel_id: string | null;
  subject: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution_notes: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface BusinessPartner {
  id: string;
  profile_id: string | null;
  company_name: string;
  partner_type: 'ecommerce' | 'courier' | 'logistics_operator' | 'property_management' | 'residential_society';
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website_url: string | null;
  monthly_parcel_volume: number;
  message: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'sandbox_enabled';
  is_demo: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  societyId: string | null;
}
