import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../app';
import { repo } from '../db/repository';
import { signAuthToken } from '../services/authService';

const app = createApp();

describe('Security: Role Escalation, Customer Isolation, Admin Scope & Delivery Access', () => {
  beforeEach(() => {
    repo.resetMemoryStore();
  });

  it('prevents privilege escalation on registration and profile update', async () => {
    // Public registration rejects super_admin role
    const badReg = await request(app).post('/api/v1/auth/register').send({
      email: 'attacker@example.com',
      password: 'Password123!',
      fullName: 'Attacker',
      role: 'super_admin',
    });
    expect(badReg.status).toBe(400);

    // Valid customer registration
    const goodReg = await request(app).post('/api/v1/auth/register').send({
      email: 'user@example.com',
      password: 'Password123!',
      fullName: 'Normal User',
    });
    expect(goodReg.status).toBe(201);
    const token = goodReg.body.token;

    // Attempt to escalate role via PATCH /auth/me
    await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ role_code: 'super_admin', role: 'super_admin', fullName: 'Updated Name' });

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.role_code).toBe('customer');
  });

  it('enforces customer isolation across parcels, bookings, and return requests', async () => {
    const regB = await request(app).post('/api/v1/auth/register').send({
      email: 'custb@example.com',
      password: 'Password123!',
      fullName: 'Customer B',
    });
    const tokenB = regB.body.token;

    const custAParcelId = repo.memory.parcels[0].id;
    const custABookingId = repo.memory.bookings[0].id;

    // Customer B cannot read Customer A parcel
    const pRes = await request(app)
      .get(`/api/v1/parcels/${custAParcelId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(pRes.status).toBe(403);

    // Customer B cannot cancel Customer A booking
    const bRes = await request(app)
      .delete(`/api/v1/delivery-bookings/${custABookingId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(bRes.status).toBe(403);

    // Customer B cannot create return request for Customer A parcel
    const rRes = await request(app)
      .post('/api/v1/customer/returns')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ parcelId: custAParcelId, reason: 'Unauthorized return' });
    expect(rRes.status).toBe(403);
  });

  it('scopes society_admin to their own society and restricts super_admin endpoints', async () => {
    const society1Id = repo.memory.societies[0].id;
    const society2Id = repo.memory.societies[1].id;
    const hub2Id = repo.memory.hubs[1].id;

    const soc1AdminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'society.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    const soc1Token = soc1AdminLogin.body.token;

    // Create a parcel in Society 2
    const soc2Parcel = await repo.createParcel({
      internal_parcel_code: 'PB-SOC2-001',
      external_tracking_id: 'TRK-SOC2-001',
      customer_id: repo.memory.profiles.find((p) => p.role_code === 'customer')!.id,
      society_id: society2Id,
      unit_id: null,
      hub_id: hub2Id,
      courier_name: 'DemoCourier',
      ecommerce_platform: null,
      description: 'Society 2 Parcel',
      weight_kg: 1,
      storage_location: 'R1',
      current_status: 'Expected',
      arrived_at: null,
      delivered_at: null,
      is_demo: true,
    });

    // Society 1 admin cannot read or update Society 2 parcel
    const readSoc2 = await request(app)
      .get(`/api/v1/parcels/${soc2Parcel.id}`)
      .set('Authorization', `Bearer ${soc1Token}`);
    expect(readSoc2.status).toBe(403);

    const updateSoc2 = await request(app)
      .patch(`/api/v1/parcels/${soc2Parcel.id}/status`)
      .set('Authorization', `Bearer ${soc1Token}`)
      .send({ status: 'Received at hub' });
    expect(updateSoc2.status).toBe(403);

    // Society 1 admin cannot access super_admin audit logs or create new societies
    const logsRes = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${soc1Token}`);
    expect(logsRes.status).toBe(403);

    const createSocRes = await request(app)
      .post('/api/v1/admin/societies')
      .set('Authorization', `Bearer ${soc1Token}`)
      .send({
        name: 'Unauthorized Society',
        code: 'UNAUTH-01',
        addressLine1: '123 St',
        city: 'City',
        state: 'State',
        postalCode: '12345',
      });
    expect(createSocRes.status).toBe(403);
    expect(society1Id).not.toBe(society2Id);
  });

  it('restricts delivery_personnel to their own assigned parcels', async () => {
    const otherDriverId = uuidv4();
    const otherDriverToken = signAuthToken({
      sub: otherDriverId,
      email: 'other.driver@example.com',
      role: 'delivery_personnel',
      societyId: repo.memory.societies[0].id,
    });

    const assignedParcelId = repo.memory.parcels[1].id;

    // Unassigned driver cannot verify OTP, confirm delivery, or mark failed
    const verifyRes = await request(app)
      .post('/api/v1/delivery/verify-otp')
      .set('Authorization', `Bearer ${otherDriverToken}`)
      .send({ parcelId: assignedParcelId, otp: '123456' });
    expect(verifyRes.status).toBe(403);

    const confirmRes = await request(app)
      .post('/api/v1/delivery/confirm')
      .set('Authorization', `Bearer ${otherDriverToken}`)
      .send({ parcelId: assignedParcelId, otp: '123456' });
    expect(confirmRes.status).toBe(403);

    const failRes = await request(app)
      .post('/api/v1/delivery/fail')
      .set('Authorization', `Bearer ${otherDriverToken}`)
      .send({ parcelId: assignedParcelId, reason: 'Not assigned' });
    expect(failRes.status).toBe(403);
  });
});
