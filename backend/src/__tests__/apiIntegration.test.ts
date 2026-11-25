import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { repo } from '../db/repository';
import { signWebhookPayload } from '../utils/crypto';

const app = createApp();

describe('PARCELBRIDGE API Integration, Auth & RBAC Tests', () => {
  beforeEach(() => {
    repo.resetMemoryStore();
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('registers a customer, logs in, and enforces IDOR protection on parcels', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'newresident@example.com',
      password: 'SecurePassword123!',
      fullName: 'New Resident',
      flatNumber: 'C-301',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();

    const otherToken = reg.body.token;
    const demoParcelId = repo.memory.parcels[0].id;

    // Customer cannot view another customer's parcel
    const forbiddenRes = await request(app)
      .get(`/api/v1/parcels/${demoParcelId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(forbiddenRes.status).toBe(403);

    // Customer cannot access admin dashboard
    const adminRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(adminRes.status).toBe(403);
  });

  it('completes full parcel dispatch + OTP handover confirmation flow', async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const deliveryLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'delivery.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    expect(deliveryLogin.status).toBe(200);
    const deliveryToken = deliveryLogin.body.token;

    const parcelId = repo.memory.parcels[1].id;
    const personnelId = repo.memory.personnel[0].id;

    const dispatch = await request(app)
      .post('/api/v1/delivery/dispatch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parcelId, personnelId, routeNotes: 'Tower A Lift 2' });
    expect(dispatch.status).toBe(200);
    const otp = dispatch.body.demoOtpPreview;
    expect(otp).toMatch(/^\d{6}$/);

    // Wrong OTP fails
    const badConfirm = await request(app)
      .post('/api/v1/delivery/confirm')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ parcelId, otp: '000000' });
    expect(badConfirm.status).toBe(400);

    // Correct OTP succeeds
    const goodConfirm = await request(app)
      .post('/api/v1/delivery/confirm')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ parcelId, otp });
    expect(goodConfirm.status).toBe(200);
    expect(goodConfirm.body.status).toBe('Delivered');
  });

  it('verifies partner webhook HMAC signatures', async () => {
    const payload = {
      partnerCode: 'BLUEDART',
      externalTrackingId: 'DEMO-AMZ-884120',
      eventType: 'parcel.arrived_at_gate',
      occurredAt: new Date().toISOString(),
    };
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `sha256=${signWebhookPayload(ts, JSON.stringify(payload))}`;

    const badRes = await request(app).post('/api/v1/webhooks/courier-event').send(payload);
    expect(badRes.status).toBe(401);

    const goodRes = await request(app)
      .post('/api/v1/webhooks/courier-event')
      .set('X-ParcelBridge-Timestamp', ts)
      .set('X-ParcelBridge-Signature', sig)
      .send(payload);
    expect(goodRes.status).toBe(202);
  });
});
