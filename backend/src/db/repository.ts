import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { getSupabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import {
  AuditLog,
  BusinessPartner,
  DeliveryAssignment,
  DeliveryBooking,
  DeliveryPersonnel,
  DeliverySlot,
  Notification,
  OtpVerification,
  Parcel,
  ParcelEvent,
  ParcelHub,
  ParcelStatus,
  Profile,
  ReturnRequest,
  SafeProfile,
  Society,
  SupportTicket,
} from '../types';
import { generateParcelQrToken } from '../utils/crypto';

export function toSafeProfile(p: Profile): SafeProfile {
  return {
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    phone: p.phone,
    role_code: p.role_code,
    society_id: p.society_id,
    unit_id: p.unit_id,
    flat_number: p.flat_number,
    is_active: p.is_active,
    is_demo: p.is_demo,
    created_at: p.created_at,
  };
}

class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    await new Promise<void>((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
    try {
      return await fn();
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.locked = false;
    }
  }
}

export interface MemoryStore {
  profiles: Profile[];
  societies: Society[];
  hubs: ParcelHub[];
  parcels: Parcel[];
  parcelEvents: ParcelEvent[];
  slots: DeliverySlot[];
  bookings: DeliveryBooking[];
  personnel: DeliveryPersonnel[];
  assignments: DeliveryAssignment[];
  otps: OtpVerification[];
  notifications: Notification[];
  returns: ReturnRequest[];
  tickets: SupportTicket[];
  partners: BusinessPartner[];
  auditLogs: AuditLog[];
}

const slotMutex = new AsyncMutex();

function buildInitialDemoStore(): MemoryStore {
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const society1Id = '11111111-1111-4111-8111-111111111101';
  const society2Id = '11111111-1111-4111-8111-111111111102';
  const hub1Id = '33333333-3333-4333-8333-333333333301';
  const hub2Id = '33333333-3333-4333-8333-333333333302';

  const demoPassHash = bcrypt.hashSync('DemoPass@2026', 10);

  const superAdminId = 'aaaa1111-1111-4111-8111-111111111101';
  const societyAdminId = 'aaaa1111-1111-4111-8111-111111111102';
  const hubManagerId = 'aaaa1111-1111-4111-8111-111111111103';
  const deliveryUserId = 'aaaa1111-1111-4111-8111-111111111104';
  const customerId = 'aaaa1111-1111-4111-8111-111111111105';
  const partnerUserId = 'aaaa1111-1111-4111-8111-111111111106';

  const personnelId = 'bbbb1111-1111-4111-8111-111111111101';

  const parcel1Id = 'cccc1111-1111-4111-8111-111111111101';
  const parcel2Id = 'cccc1111-1111-4111-8111-111111111102';
  const parcel3Id = 'cccc1111-1111-4111-8111-111111111103';

  const slot1Id = 'dddd1111-1111-4111-8111-111111111101';
  const slot2Id = 'dddd1111-1111-4111-8111-111111111102';
  const slot3Id = 'dddd1111-1111-4111-8111-111111111103';

  const booking1Id = 'eeee1111-1111-4111-8111-111111111101';

  const profiles: Profile[] = env.demoMode
    ? [
        {
          id: superAdminId,
          email: 'admin.demo@parcelbridge.io',
          password_hash: demoPassHash,
          full_name: 'Aarav Mehta (Demo Super Admin)',
          phone: '+91-9800000001',
          role_code: 'super_admin',
          society_id: null,
          unit_id: null,
          flat_number: null,
          is_active: true,
          is_demo: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: societyAdminId,
          email: 'society.demo@parcelbridge.io',
          password_hash: demoPassHash,
          full_name: 'Priya Nair (Demo Society Admin)',
          phone: '+91-9800000002',
          role_code: 'society_admin',
          society_id: society1Id,
          unit_id: null,
          flat_number: 'Office-1',
          is_active: true,
          is_demo: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: hubManagerId,
          email: 'hub.demo@parcelbridge.io',
          password_hash: demoPassHash,
          full_name: 'Vikram Rao (Demo Hub Manager)',
          phone: '+91-9800000003',
          role_code: 'hub_manager',
          society_id: society1Id,
          unit_id: null,
          flat_number: null,
          is_active: true,
          is_demo: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: deliveryUserId,
          email: 'delivery.demo@parcelbridge.io',
          password_hash: demoPassHash,
          full_name: 'Rohan Kumar (Demo Delivery Staff)',
          phone: '+91-9800000004',
          role_code: 'delivery_personnel',
          society_id: society1Id,
          unit_id: null,
          flat_number: null,
          is_active: true,
          is_demo: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: customerId,
          email: 'customer.demo@parcelbridge.io',
          password_hash: demoPassHash,
          full_name: 'Ananya Sharma (Demo Resident)',
          phone: '+91-9800000005',
          role_code: 'customer',
          society_id: society1Id,
          unit_id: null,
          flat_number: 'A-402',
          is_active: true,
          is_demo: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: partnerUserId,
          email: 'partner.demo@parcelbridge.io',
          password_hash: demoPassHash,
          full_name: 'Siddharth Verma (Demo Partner)',
          phone: '+91-9800000006',
          role_code: 'business_partner',
          society_id: null,
          unit_id: null,
          flat_number: null,
          is_active: true,
          is_demo: true,
          created_at: now,
          updated_at: now,
        },
      ]
    : [];

  return {
    profiles,
    societies: [
      {
        id: society1Id,
        name: 'Skyline Residency',
        code: 'SKY-BLR-01',
        address_line1: 'Outer Ring Road, Bellandur',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560103',
        timezone: 'Asia/Kolkata',
        total_units: 420,
        is_active: true,
        is_demo: true,
        created_at: now,
      },
      {
        id: society2Id,
        name: 'Emerald Greens Cooperative',
        code: 'EMG-MUM-02',
        address_line1: 'Powai Lake Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        postal_code: '400076',
        timezone: 'Asia/Kolkata',
        total_units: 280,
        is_active: true,
        is_demo: true,
        created_at: now,
      },
    ],
    hubs: [
      {
        id: hub1Id,
        society_id: society1Id,
        name: 'Skyline Gate-1 Smart Hub',
        code: 'HUB-SKY-01',
        location_description: 'Basement Level 1, Near Tower A Lift Lobby',
        capacity: 600,
        current_occupancy: 3,
        operating_hours: '07:00 - 22:00',
        is_active: true,
        is_demo: true,
        created_at: now,
      },
      {
        id: hub2Id,
        society_id: society2Id,
        name: 'Emerald Central Parcel Room',
        code: 'HUB-EMG-01',
        location_description: 'Clubhouse Ground Floor Annex',
        capacity: 400,
        current_occupancy: 1,
        operating_hours: '07:30 - 21:30',
        is_active: true,
        is_demo: true,
        created_at: now,
      },
    ],
    parcels: env.demoMode
      ? [
          {
            id: parcel1Id,
            internal_parcel_code: 'PB-SKY-2026-0001',
            external_tracking_id: 'DEMO-AMZ-884120',
            customer_id: customerId,
            society_id: society1Id,
            unit_id: null,
            hub_id: hub1Id,
            courier_name: 'BlueDart Express (Demo)',
            ecommerce_platform: 'Amazon (Demo)',
            description: 'Noise-Cancelling Headphones (Fragile)',
            weight_kg: 0.85,
            storage_location: 'RACK-A-14',
            qr_token: generateParcelQrToken(parcel1Id),
            current_status: 'Stored',
            arrived_at: now,
            delivered_at: null,
            is_demo: true,
            created_at: now,
            updated_at: now,
          },
          {
            id: parcel2Id,
            internal_parcel_code: 'PB-SKY-2026-0002',
            external_tracking_id: 'DEMO-FLP-551902',
            customer_id: customerId,
            society_id: society1Id,
            unit_id: null,
            hub_id: hub1Id,
            courier_name: 'Delhivery (Demo)',
            ecommerce_platform: 'Flipkart (Demo)',
            description: 'Ergonomic Mechanical Keyboard',
            weight_kg: 1.4,
            storage_location: 'RACK-B-03',
            qr_token: generateParcelQrToken(parcel2Id),
            current_status: 'Delivery scheduled',
            arrived_at: now,
            delivered_at: null,
            is_demo: true,
            created_at: now,
            updated_at: now,
          },
          {
            id: parcel3Id,
            internal_parcel_code: 'PB-SKY-2026-0003',
            external_tracking_id: 'DEMO-MYN-330199',
            customer_id: customerId,
            society_id: society1Id,
            unit_id: null,
            hub_id: hub1Id,
            courier_name: 'XpressBees (Demo)',
            ecommerce_platform: 'Myntra (Demo)',
            description: 'Apparel Package (2 items)',
            weight_kg: 0.65,
            storage_location: 'RACK-C-09',
            qr_token: generateParcelQrToken(parcel3Id),
            current_status: 'Expected',
            arrived_at: null,
            delivered_at: null,
            is_demo: true,
            created_at: now,
            updated_at: now,
          },
        ]
      : [],
    parcelEvents: env.demoMode
      ? [
          {
            id: uuidv4(),
            parcel_id: parcel1Id,
            previous_status: 'Verified',
            new_status: 'Stored',
            actor_id: hubManagerId,
            actor_role: 'hub_manager',
            location: 'HUB-SKY-01 / RACK-A-14',
            notes: 'Parcel scanned and placed in temperature-controlled rack',
            created_at: now,
          },
          {
            id: uuidv4(),
            parcel_id: parcel2Id,
            previous_status: 'Stored',
            new_status: 'Delivery scheduled',
            actor_id: customerId,
            actor_role: 'customer',
            location: 'HUB-SKY-01',
            notes: 'Customer booked evening slot 18:00 - 20:00',
            created_at: now,
          },
        ]
      : [],
    slots: [
      {
        id: slot1Id,
        hub_id: hub1Id,
        society_id: society1Id,
        slot_date: today,
        start_time: '18:00:00',
        end_time: '20:00:00',
        timezone: 'Asia/Kolkata',
        max_capacity: 15,
        booked_count: 1,
        staff_available: 2,
        is_active: true,
        is_demo: true,
        created_at: now,
      },
      {
        id: slot2Id,
        hub_id: hub1Id,
        society_id: society1Id,
        slot_date: tomorrow,
        start_time: '09:00:00',
        end_time: '11:00:00',
        timezone: 'Asia/Kolkata',
        max_capacity: 20,
        booked_count: 0,
        staff_available: 3,
        is_active: true,
        is_demo: true,
        created_at: now,
      },
      {
        id: slot3Id,
        hub_id: hub1Id,
        society_id: society1Id,
        slot_date: tomorrow,
        start_time: '19:00:00',
        end_time: '21:00:00',
        timezone: 'Asia/Kolkata',
        max_capacity: 12,
        booked_count: 0,
        staff_available: 2,
        is_active: true,
        is_demo: true,
        created_at: now,
      },
    ],
    bookings: env.demoMode
      ? [
          {
            id: booking1Id,
            parcel_id: parcel2Id,
            customer_id: customerId,
            slot_id: slot1Id,
            status: 'confirmed',
            delivery_instructions: 'Please ring doorbell once; leave at doorstep only after OTP.',
            reschedule_count: 0,
            is_demo: true,
            created_at: now,
            updated_at: now,
          },
        ]
      : [],
    personnel: env.demoMode
      ? [
          {
            id: personnelId,
            profile_id: deliveryUserId,
            hub_id: hub1Id,
            employee_code: 'PB-DEL-101',
            vehicle_type: 'ev_cart',
            shift_start: '08:00:00',
            shift_end: '21:00:00',
            is_available: true,
            active_deliveries_count: 1,
            is_demo: true,
          },
        ]
      : [],
    assignments: env.demoMode
      ? [
          {
            id: uuidv4(),
            parcel_id: parcel2Id,
            booking_id: booking1Id,
            personnel_id: personnelId,
            assigned_by: hubManagerId,
            route_sequence: 1,
            route_notes: 'Tower A -> Lift 2 -> 4th Floor A-402',
            status: 'assigned',
            failure_reason: null,
            completed_at: null,
            is_demo: true,
            created_at: now,
          },
        ]
      : [],
    otps: [],
    notifications: env.demoMode
      ? [
          {
            id: uuidv4(),
            recipient_id: customerId,
            parcel_id: parcel1Id,
            title: 'Parcel Stored at Skyline Hub',
            message: 'Your parcel PB-SKY-2026-0001 has arrived and is ready for slot scheduling.',
            category: 'parcel_update',
            is_read: false,
            created_at: now,
          },
        ]
      : [],
    returns: [],
    tickets: [],
    partners: env.demoMode
      ? [
          {
            id: uuidv4(),
            profile_id: partnerUserId,
            company_name: 'SwiftCart Logistics (Demo)',
            partner_type: 'logistics_operator',
            contact_name: 'Siddharth Verma',
            contact_email: 'partner.demo@parcelbridge.io',
            contact_phone: '+91-9800000006',
            website_url: 'https://example.com',
            monthly_parcel_volume: 45000,
            message: 'Interested in gated-society hub drop-off integration in Bengaluru.',
            status: 'under_review',
            is_demo: true,
            created_at: now,
          },
        ]
      : [],
    auditLogs: [],
  };
}

class Repository {
  private store: MemoryStore = buildInitialDemoStore();

  public resetMemoryStore(): void {
    this.store = buildInitialDemoStore();
  }

  public get memory(): MemoryStore {
    return this.store;
  }

  // ---- Profiles ----
  async findProfileByEmail(email: string): Promise<Profile | null> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('profiles')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as Profile | null;
    }
    return this.store.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findProfileById(id: string): Promise<Profile | null> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('profiles').select('*').eq('id', id).maybeSingle();
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as Profile | null;
    }
    return this.store.profiles.find((p) => p.id === id) ?? null;
  }

  async createProfile(input: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile> {
    const now = new Date().toISOString();
    const record: Profile = { ...input, id: uuidv4(), email: input.email.toLowerCase(), created_at: now, updated_at: now };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('profiles').insert(record).select('*').single();
      if (error) throw new AppError(400, error.message, 'PROFILE_CREATE_FAILED');
      return data as Profile;
    }
    this.store.profiles.push(record);
    return record;
  }

  async updateProfile(id: string, patch: Partial<Profile>): Promise<Profile> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('profiles').update(patch).eq('id', id).select('*').single();
      if (error) throw new AppError(400, error.message, 'PROFILE_UPDATE_FAILED');
      return data as Profile;
    }
    const idx = this.store.profiles.findIndex((p) => p.id === id);
    if (idx === -1) throw new AppError(404, 'Profile not found', 'NOT_FOUND');
    this.store.profiles[idx] = { ...this.store.profiles[idx], ...patch, updated_at: new Date().toISOString() };
    return this.store.profiles[idx];
  }

  async listProfiles(): Promise<SafeProfile[]> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return (data as Profile[]).map(toSafeProfile);
    }
    return this.store.profiles.map(toSafeProfile);
  }

  // ---- Societies & Hubs ----
  async listSocieties(): Promise<Society[]> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('societies').select('*').order('name');
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as Society[];
    }
    return this.store.societies;
  }

  async createSociety(input: Omit<Society, 'id' | 'created_at'>): Promise<Society> {
    const record: Society = { ...input, id: uuidv4(), created_at: new Date().toISOString() };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('societies').insert(record).select('*').single();
      if (error) throw new AppError(400, error.message, 'SOCIETY_CREATE_FAILED');
      return data as Society;
    }
    this.store.societies.push(record);
    return record;
  }

  async listHubs(): Promise<ParcelHub[]> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('parcel_hubs').select('*').order('name');
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as ParcelHub[];
    }
    return this.store.hubs;
  }

  async createHub(input: Omit<ParcelHub, 'id' | 'created_at'>): Promise<ParcelHub> {
    const record: ParcelHub = { ...input, id: uuidv4(), created_at: new Date().toISOString() };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('parcel_hubs').insert(record).select('*').single();
      if (error) throw new AppError(400, error.message, 'HUB_CREATE_FAILED');
      return data as ParcelHub;
    }
    this.store.hubs.push(record);
    return record;
  }

  // ---- Parcels & Events ----
  async listParcels(filter?: { customerId?: string; societyId?: string; status?: ParcelStatus }): Promise<Parcel[]> {
    if (env.storageDriver === 'supabase') {
      let query = getSupabaseAdmin().from('parcels').select('*').order('created_at', { ascending: false });
      if (filter?.customerId) query = query.eq('customer_id', filter.customerId);
      if (filter?.societyId) query = query.eq('society_id', filter.societyId);
      if (filter?.status) query = query.eq('current_status', filter.status);
      const { data, error } = await query;
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as Parcel[];
    }
    return this.store.parcels.filter((p) => {
      if (filter?.customerId && p.customer_id !== filter.customerId) return false;
      if (filter?.societyId && p.society_id !== filter.societyId) return false;
      if (filter?.status && p.current_status !== filter.status) return false;
      return true;
    });
  }

  async findParcelById(id: string): Promise<Parcel | null> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('parcels').select('*').eq('id', id).maybeSingle();
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as Parcel | null;
    }
    return this.store.parcels.find((p) => p.id === id) ?? null;
  }

  async findParcelByTracking(trackingId: string): Promise<Parcel | null> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('parcels')
        .select('*')
        .or(`external_tracking_id.eq.${trackingId},internal_parcel_code.eq.${trackingId}`)
        .maybeSingle();
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as Parcel | null;
    }
    return (
      this.store.parcels.find(
        (p) => p.external_tracking_id === trackingId || p.internal_parcel_code === trackingId
      ) ?? null
    );
  }

  async createParcel(input: Omit<Parcel, 'id' | 'qr_token' | 'created_at' | 'updated_at'>): Promise<Parcel> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: Parcel = {
      ...input,
      id,
      qr_token: generateParcelQrToken(id),
      created_at: now,
      updated_at: now,
    };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('parcels').insert(record).select('*').single();
      if (error) throw new AppError(400, error.message, 'PARCEL_CREATE_FAILED');
      return data as Parcel;
    }
    this.store.parcels.unshift(record);
    return record;
  }

  async updateParcel(id: string, patch: Partial<Parcel>): Promise<Parcel> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('parcels').update(patch).eq('id', id).select('*').single();
      if (error) throw new AppError(400, error.message, 'PARCEL_UPDATE_FAILED');
      return data as Parcel;
    }
    const idx = this.store.parcels.findIndex((p) => p.id === id);
    if (idx === -1) throw new AppError(404, 'Parcel not found', 'NOT_FOUND');
    this.store.parcels[idx] = { ...this.store.parcels[idx], ...patch, updated_at: new Date().toISOString() };
    return this.store.parcels[idx];
  }

  async addParcelEvent(event: Omit<ParcelEvent, 'id' | 'created_at'>): Promise<ParcelEvent> {
    const record: ParcelEvent = { ...event, id: uuidv4(), created_at: new Date().toISOString() };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('parcel_events').insert(record).select('*').single();
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as ParcelEvent;
    }
    this.store.parcelEvents.unshift(record);
    return record;
  }

  async listParcelEvents(parcelId: string): Promise<ParcelEvent[]> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('parcel_events')
        .select('*')
        .eq('parcel_id', parcelId)
        .order('created_at', { ascending: false });
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as ParcelEvent[];
    }
    return this.store.parcelEvents.filter((e) => e.parcel_id === parcelId);
  }

  // ---- Scheduling & Atomic Slot Reservation ----
  async listSlots(filter?: { societyId?: string; date?: string }): Promise<DeliverySlot[]> {
    if (env.storageDriver === 'supabase') {
      let query = getSupabaseAdmin().from('delivery_slots').select('*').eq('is_active', true).order('slot_date');
      if (filter?.societyId) query = query.eq('society_id', filter.societyId);
      if (filter?.date) query = query.eq('slot_date', filter.date);
      const { data, error } = await query;
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as DeliverySlot[];
    }
    return this.store.slots.filter((s) => {
      if (!s.is_active) return false;
      if (filter?.societyId && s.society_id !== filter.societyId) return false;
      if (filter?.date && s.slot_date !== filter.date) return false;
      return true;
    });
  }

  async createSlot(input: Omit<DeliverySlot, 'id' | 'booked_count' | 'created_at'>): Promise<DeliverySlot> {
    const record: DeliverySlot = { ...input, id: uuidv4(), booked_count: 0, created_at: new Date().toISOString() };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('delivery_slots').insert(record).select('*').single();
      if (error) throw new AppError(400, error.message, 'SLOT_CREATE_FAILED');
      return data as DeliverySlot;
    }
    this.store.slots.push(record);
    return record;
  }

  /**
   * Atomic slot booking: uses PostgreSQL RPC `reserve_delivery_slot` in Supabase mode,
   * and an exclusive AsyncMutex in memory mode to guarantee zero race conditions.
   */
  async reserveSlotAtomic(params: {
    parcelId: string;
    customerId: string;
    slotId: string;
    instructions?: string;
  }): Promise<{ booking_id: string; slot_id: string; remaining_capacity: number }> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().rpc('reserve_delivery_slot', {
        p_parcel_id: params.parcelId,
        p_customer_id: params.customerId,
        p_slot_id: params.slotId,
        p_instructions: params.instructions ?? null,
      });
      if (error) {
        if (error.message.includes('SLOT_CAPACITY_FULL')) throw new AppError(409, 'Selected delivery slot is full', 'SLOT_CAPACITY_FULL');
        if (error.message.includes('FORBIDDEN_PARCEL_ACCESS')) throw new AppError(403, 'You do not own this parcel', 'FORBIDDEN');
        if (error.message.includes('PARCEL_NOT_FOUND')) throw new AppError(404, 'Parcel not found', 'NOT_FOUND');
        throw new AppError(400, error.message, 'BOOKING_FAILED');
      }
      return data as { booking_id: string; slot_id: string; remaining_capacity: number };
    }

    return slotMutex.runExclusive(() => {
      const parcel = this.store.parcels.find((p) => p.id === params.parcelId);
      if (!parcel) throw new AppError(404, 'Parcel not found', 'NOT_FOUND');
      if (parcel.customer_id !== params.customerId) {
        throw new AppError(403, 'You do not have permission to schedule this parcel', 'FORBIDDEN');
      }
      if (!['Stored', 'Ready for delivery', 'Delivery attempted', 'Delivery scheduled'].includes(parcel.current_status)) {
        throw new AppError(400, `Parcel in status "${parcel.current_status}" cannot be scheduled`, 'INVALID_PARCEL_STATE');
      }

      const slot = this.store.slots.find((s) => s.id === params.slotId && s.is_active);
      if (!slot) throw new AppError(404, 'Delivery slot not found or inactive', 'SLOT_NOT_AVAILABLE');
      if (slot.society_id !== parcel.society_id || slot.hub_id !== parcel.hub_id) {
        throw new AppError(400, 'Delivery slot does not match parcel society or hub', 'SLOT_HUB_MISMATCH');
      }
      if (slot.booked_count >= slot.max_capacity) {
        throw new AppError(409, 'Delivery slot capacity is full', 'SLOT_CAPACITY_FULL');
      }

      // Release any previous active confirmed booking for this parcel
      const existing = this.store.bookings.find((b) => b.parcel_id === parcel.id && b.status === 'confirmed');
      if (existing) {
        const oldSlot = this.store.slots.find((s) => s.id === existing.slot_id);
        if (oldSlot && oldSlot.booked_count > 0) oldSlot.booked_count -= 1;
        existing.status = 'rescheduled';
        existing.reschedule_count += 1;
        existing.updated_at = new Date().toISOString();
      }

      slot.booked_count += 1;
      const now = new Date().toISOString();
      const booking: DeliveryBooking = {
        id: uuidv4(),
        parcel_id: parcel.id,
        customer_id: params.customerId,
        slot_id: slot.id,
        status: 'confirmed',
        delivery_instructions: params.instructions ?? null,
        reschedule_count: existing ? existing.reschedule_count : 0,
        is_demo: parcel.is_demo,
        created_at: now,
        updated_at: now,
      };
      this.store.bookings.unshift(booking);

      const prevStatus = parcel.current_status;
      parcel.current_status = 'Delivery scheduled';
      parcel.updated_at = now;
      this.store.parcelEvents.unshift({
        id: uuidv4(),
        parcel_id: parcel.id,
        previous_status: prevStatus,
        new_status: 'Delivery scheduled',
        actor_id: params.customerId,
        actor_role: 'customer',
        location: slot.slot_date,
        notes: `Scheduled for ${slot.slot_date} (${slot.start_time} - ${slot.end_time})`,
        created_at: now,
      });

      return {
        booking_id: booking.id,
        slot_id: slot.id,
        remaining_capacity: slot.max_capacity - slot.booked_count,
      };
    });
  }

  async cancelBookingAtomic(bookingId: string, actorId: string, isAdmin: boolean): Promise<DeliveryBooking> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().rpc('cancel_delivery_booking', {
        p_booking_id: bookingId,
        p_actor_id: actorId,
        p_is_admin: isAdmin,
      });
      if (error) {
        if (error.message.includes('BOOKING_NOT_FOUND')) throw new AppError(404, 'Booking not found', 'NOT_FOUND');
        if (error.message.includes('FORBIDDEN_BOOKING_ACCESS')) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
        if (error.message.includes('INVALID_BOOKING_STATE')) {
          throw new AppError(400, 'Only confirmed bookings can be cancelled', 'INVALID_BOOKING_STATE');
        }
        throw new AppError(400, error.message, 'BOOKING_CANCEL_FAILED');
      }
      return data as DeliveryBooking;
    }

    return slotMutex.runExclusive(() => {
      const booking = this.store.bookings.find((b) => b.id === bookingId);
      if (!booking) throw new AppError(404, 'Booking not found', 'NOT_FOUND');
      if (!isAdmin && booking.customer_id !== actorId) {
        throw new AppError(403, 'You do not have permission to cancel this booking', 'FORBIDDEN');
      }
      if (booking.status !== 'confirmed') {
        throw new AppError(400, 'Only confirmed bookings can be cancelled', 'INVALID_BOOKING_STATE');
      }
      booking.status = 'cancelled';
      booking.updated_at = new Date().toISOString();

      const slot = this.store.slots.find((s) => s.id === booking.slot_id);
      if (slot && slot.booked_count > 0) slot.booked_count -= 1;

      const parcel = this.store.parcels.find((p) => p.id === booking.parcel_id);
      if (parcel && parcel.current_status === 'Delivery scheduled') {
        parcel.current_status = 'Stored';
        parcel.updated_at = new Date().toISOString();
      }
      return booking;
    });
  }

  async listBookings(customerId?: string): Promise<DeliveryBooking[]> {
    if (env.storageDriver === 'supabase') {
      let q = getSupabaseAdmin().from('delivery_bookings').select('*').order('created_at', { ascending: false });
      if (customerId) q = q.eq('customer_id', customerId);
      const { data, error } = await q;
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as DeliveryBooking[];
    }
    return customerId ? this.store.bookings.filter((b) => b.customer_id === customerId) : this.store.bookings;
  }

  // ---- Notifications & Audit Logs ----
  async addNotification(input: Omit<Notification, 'id' | 'is_read' | 'created_at'>): Promise<Notification> {
    const record: Notification = { ...input, id: uuidv4(), is_read: false, created_at: new Date().toISOString() };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('notifications').insert(record).select('*').single();
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as Notification;
    }
    this.store.notifications.unshift(record);
    return record;
  }

  async listNotifications(recipientId: string): Promise<Notification[]> {
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('notifications')
        .select('*')
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false });
      if (error) throw new AppError(500, error.message, 'DB_ERROR');
      return data as Notification[];
    }
    return this.store.notifications.filter((n) => n.recipient_id === recipientId);
  }

  async addAuditLog(input: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
    const record: AuditLog = { ...input, id: uuidv4(), created_at: new Date().toISOString() };
    if (env.storageDriver === 'supabase') {
      await getSupabaseAdmin().from('audit_logs').insert(record);
      return;
    }
    this.store.auditLogs.unshift(record);
  }
}

export const repo = new Repository();
