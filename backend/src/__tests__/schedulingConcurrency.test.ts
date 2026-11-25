import { beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { repo } from '../db/repository';

describe('Delivery Booking Concurrency Control', () => {
  beforeEach(() => {
    repo.resetMemoryStore();
  });

  it('prevents two concurrent users from reserving the final available slot capacity', async () => {
    const societyId = repo.memory.societies[0].id;
    const hubId = repo.memory.hubs[0].id;

    // Create a slot with max_capacity = 1
    const singleSlot = await repo.createSlot({
      hub_id: hubId,
      society_id: societyId,
      slot_date: '2026-12-01',
      start_time: '10:00:00',
      end_time: '12:00:00',
      timezone: 'Asia/Kolkata',
      max_capacity: 1,
      staff_available: 1,
      is_active: true,
      is_demo: true,
    });

    const customerA = uuidv4();
    const customerB = uuidv4();

    repo.memory.profiles.push(
      {
        id: customerA,
        email: 'a@test.com',
        password_hash: 'x',
        full_name: 'Customer A',
        phone: null,
        role_code: 'customer',
        society_id: societyId,
        unit_id: null,
        flat_number: 'A-101',
        is_active: true,
        is_demo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: customerB,
        email: 'b@test.com',
        password_hash: 'x',
        full_name: 'Customer B',
        phone: null,
        role_code: 'customer',
        society_id: societyId,
        unit_id: null,
        flat_number: 'B-102',
        is_active: true,
        is_demo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    const parcelA = await repo.createParcel({
      internal_parcel_code: 'PB-TEST-A',
      external_tracking_id: 'TRK-A',
      customer_id: customerA,
      society_id: societyId,
      unit_id: null,
      hub_id: hubId,
      courier_name: 'DemoCourier',
      ecommerce_platform: null,
      description: 'Package A',
      weight_kg: 1,
      storage_location: 'R1',
      current_status: 'Stored',
      arrived_at: new Date().toISOString(),
      delivered_at: null,
      is_demo: true,
    });

    const parcelB = await repo.createParcel({
      internal_parcel_code: 'PB-TEST-B',
      external_tracking_id: 'TRK-B',
      customer_id: customerB,
      society_id: societyId,
      unit_id: null,
      hub_id: hubId,
      courier_name: 'DemoCourier',
      ecommerce_platform: null,
      description: 'Package B',
      weight_kg: 1,
      storage_location: 'R2',
      current_status: 'Stored',
      arrived_at: new Date().toISOString(),
      delivered_at: null,
      is_demo: true,
    });

    // Fire both reservations simultaneously
    const results = await Promise.allSettled([
      repo.reserveSlotAtomic({ parcelId: parcelA.id, customerId: customerA, slotId: singleSlot.id }),
      repo.reserveSlotAtomic({ parcelId: parcelB.id, customerId: customerB, slotId: singleSlot.id }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(singleSlot.booked_count).toBe(1);
  });
});
