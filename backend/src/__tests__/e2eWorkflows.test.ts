import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { repo } from '../db/repository';

const app = createApp();

describe('PARCELBRIDGE Complete 12-Step E2E Workflows', () => {
  let customerToken = '';
  let customerId = '';
  let customer2Token = '';
  let adminToken = '';
  let deliveryToken = '';
  let parcelId = '';
  let qrToken = '';
  let slot8pmId = '';
  let handoverOtp = '';

  const societyId = repo.memory.societies[0].id;
  const hubId = repo.memory.hubs[0].id;
  const personnelId = repo.memory.personnel[0].id;

  beforeAll(() => {
    repo.resetMemoryStore();
  });

  it('TEST 1: Customer registers and logs in', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'e2e.customer1@example.com',
      password: 'Password123!',
      fullName: 'E2E Resident One',
      phone: '+91-9900000011',
      societyId,
      flatNumber: 'A-701',
    });
    expect(reg.status).toBe(201);
    customerId = reg.body.user.id;

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'e2e.customer1@example.com',
      password: 'Password123!',
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    customerToken = login.body.token;
  });

  it('TEST 2: Administrator registers a parcel', async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.token;

    const createRes = await request(app)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        externalTrackingId: 'E2E-TRK-9001',
        customerId,
        societyId,
        hubId,
        courierName: 'BlueDart Express',
        ecommercePlatform: 'Amazon',
        description: 'E2E Test Laptop Stand',
        weightKg: 1.2,
        storageLocation: 'RACK-D-01',
      });
    expect(createRes.status).toBe(201);
    parcelId = createRes.body.parcel.id;
    qrToken = createRes.body.parcel.qr_token;
    expect(createRes.body.parcel.current_status).toBe('Received at hub');
  });

  it('TEST 3: Parcel hub scans the parcel QR code and stores it', async () => {
    const scanRes = await request(app)
      .post('/api/v1/parcels/scan-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrToken });
    expect(scanRes.status).toBe(200);
    expect(scanRes.body.parcel.current_status).toBe('Scanned');

    const storeRes = await request(app)
      .patch(`/api/v1/parcels/${parcelId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Stored', storageLocation: 'RACK-D-01' });
    expect(storeRes.status).toBe(200);
    expect(storeRes.body.parcel.current_status).toBe('Stored');
  });

  it('TEST 4: Customer sees the incoming parcel', async () => {
    const listRes = await request(app)
      .get('/api/v1/parcels')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(listRes.status).toBe(200);
    const found = listRes.body.parcels.find((p: { id: string }) => p.id === parcelId);
    expect(found).toBeTruthy();
    expect(found.current_status).toBe('Stored');
  });

  it('TEST 5: Customer schedules delivery for 8 PM', async () => {
    const slotRes = await request(app)
      .post('/api/v1/delivery-slots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        hubId,
        societyId,
        slotDate: '2026-12-05',
        startTime: '20:00:00',
        endTime: '21:00:00',
        maxCapacity: 5,
      });
    expect(slotRes.status).toBe(201);
    slot8pmId = slotRes.body.slot.id;

    const bookRes = await request(app)
      .post('/api/v1/delivery-bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ parcelId, slotId: slot8pmId, deliveryInstructions: 'Ring bell at 8 PM' });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body.booking.slot_id).toBe(slot8pmId);
  });

  it('TEST 6: Two customers attempt to book the last available slot simultaneously; only one succeeds', async () => {
    const tightSlotRes = await request(app)
      .post('/api/v1/delivery-slots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        hubId,
        societyId,
        slotDate: '2026-12-06',
        startTime: '18:00:00',
        endTime: '19:00:00',
        maxCapacity: 1,
      });
    const tightSlotId = tightSlotRes.body.slot.id;

    const reg2 = await request(app).post('/api/v1/auth/register').send({
      email: 'e2e.customer2@example.com',
      password: 'Password123!',
      fullName: 'E2E Resident Two',
      societyId,
      flatNumber: 'B-204',
    });
    customer2Token = reg2.body.token;
    const c2Id = reg2.body.user.id;

    const p2Res = await request(app)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        externalTrackingId: 'E2E-TRK-9002',
        customerId: c2Id,
        societyId,
        hubId,
        courierName: 'Delhivery',
        description: 'E2E Test Book',
        initialStatus: 'Stored',
      });
    const p2Id = p2Res.body.parcel.id;

    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/v1/delivery-bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ parcelId, slotId: tightSlotId }),
      request(app)
        .post('/api/v1/delivery-bookings')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ parcelId: p2Id, slotId: tightSlotId }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('TEST 7: Delivery personnel sees the assigned delivery', async () => {
    const dispatchRes = await request(app)
      .post('/api/v1/delivery/dispatch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parcelId, personnelId, routeNotes: 'Tower A Lift 1' });
    expect(dispatchRes.status).toBe(200);
    handoverOtp = dispatchRes.body.demoOtpPreview;
    expect(handoverOtp).toMatch(/^\d{6}$/);

    const delLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'delivery.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    expect(delLogin.status).toBe(200);
    deliveryToken = delLogin.body.token;

    const assignRes = await request(app)
      .get('/api/v1/delivery/assignments')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.assignments.some((a: { parcel_id: string }) => a.parcel_id === parcelId)).toBe(true);
  });

  it('TEST 8 & TEST 9: Delivery personnel verifies customer OTP and parcel status changes to Delivered', async () => {
    const confirmRes = await request(app)
      .post('/api/v1/delivery/confirm')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ parcelId, otp: handoverOtp });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe('Delivered');
  });

  it('TEST 10: Customer can view the completed delivery history', async () => {
    const detailRes = await request(app)
      .get(`/api/v1/parcels/${parcelId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.parcel.current_status).toBe('Delivered');
    expect(detailRes.body.events.length).toBeGreaterThanOrEqual(4);
  });

  it('TEST 11: Unauthorized users cannot access another customer parcel', async () => {
    const idorRes = await request(app)
      .get(`/api/v1/parcels/${parcelId}`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(idorRes.status).toBe(403);
  });

  it('TEST 12: Business partner can submit a partnership enquiry', async () => {
    const partnerRes = await request(app).post('/api/v1/partners/apply').send({
      companyName: 'QuickShip Logistics Pvt Ltd',
      partnerType: 'courier',
      contactName: 'Riya Kapoor',
      contactEmail: 'riya@quickship.example.com',
      contactPhone: '+91-9811112233',
      monthlyParcelVolume: 25000,
      message: 'Seeking society hub integration in Bengaluru.',
    });
    expect(partnerRes.status).toBe(201);
    expect(partnerRes.body.application.status).toBe('pending');
  });

  it('TEST 13: Booking cancellation restores slot capacity, plus return request, support ticket, and public tracking', async () => {
    const slotRes = await request(app)
      .post('/api/v1/delivery-slots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        hubId,
        societyId,
        slotDate: '2026-12-08',
        startTime: '14:00:00',
        endTime: '16:00:00',
        maxCapacity: 1,
      });
    const cancelSlotId = slotRes.body.slot.id;

    const p3Res = await request(app)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        externalTrackingId: 'E2E-TRK-9003',
        customerId,
        societyId,
        hubId,
        courierName: 'XpressBees',
        description: 'E2E Cancel & Return Test Parcel',
        initialStatus: 'Stored',
      });
    const p3Id = p3Res.body.parcel.id;

    const bookRes = await request(app)
      .post('/api/v1/delivery-bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ parcelId: p3Id, slotId: cancelSlotId });
    expect(bookRes.status).toBe(201);
    const bookingId = bookRes.body.booking.booking_id;

    const delRes = await request(app)
      .delete(`/api/v1/delivery-bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.booking.status).toBe('cancelled');

    const slotsAfter = await request(app).get(`/api/v1/delivery-slots?societyId=${societyId}`);
    const restored = slotsAfter.body.slots.find((s: { id: string }) => s.id === cancelSlotId);
    expect(restored.booked_count).toBe(0);

    const retRes = await request(app)
      .post('/api/v1/customer/returns')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ parcelId, reason: 'Wrong size ordered' });
    expect(retRes.status).toBe(201);

    const ticketRes = await request(app)
      .post('/api/v1/customer/support-tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ parcelId, subject: 'Package dent', description: 'Outer box slightly dented on arrival' });
    expect(ticketRes.status).toBe(201);

    const trackRes = await request(app).get('/api/v1/parcels/track/E2E-TRK-9003');
    expect(trackRes.status).toBe(200);
    expect(trackRes.body.tracking.externalTrackingId).toBe('E2E-TRK-9003');
  });
});
