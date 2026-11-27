import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../app';
import { repo } from '../db/repository';
import { signAuthToken } from '../services/authService';

const app = createApp();

describe('Security: Role Escalation, Tenant Isolation, IDOR, Notification & Driver Scope', () => {
  beforeEach(() => {
    repo.resetMemoryStore();
  });

  it('prevents privilege escalation and tenant (societyId) reassignment on registration and profile update', async () => {
    const badReg = await request(app).post('/api/v1/auth/register').send({
      email: 'attacker@example.com',
      password: 'Password123!',
      fullName: 'Attacker',
      role: 'super_admin',
    });
    expect(badReg.status).toBe(400);

    const society1Id = repo.memory.societies[0].id;
    const society2Id = repo.memory.societies[1].id;

    const goodReg = await request(app).post('/api/v1/auth/register').send({
      email: 'user@example.com',
      password: 'Password123!',
      fullName: 'Normal User',
      societyId: society1Id,
    });
    expect(goodReg.status).toBe(201);
    const token = goodReg.body.token;
    const originalId = goodReg.body.user.id;

    // Customer cannot reassign their own societyId
    const tenantChangeRes = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ societyId: society2Id });
    expect(tenantChangeRes.status).toBe(403);

    // Attempt to mutate privileged fields via PATCH /auth/me
    await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: uuidv4(),
        auth_user_id: uuidv4(),
        role_code: 'super_admin',
        role: 'super_admin',
        is_active: false,
        is_demo: true,
        fullName: 'Updated Name',
      });

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(originalId);
    expect(meRes.body.user.society_id).toBe(society1Id);
    expect(meRes.body.user.role_code).toBe('customer');
    expect(meRes.body.user.is_active).toBe(true);
    expect(meRes.body.user.is_demo).toBe(false);
    expect(meRes.body.user.full_name).toBe('Updated Name');
    expect(meRes.body.user.password_hash).toBeUndefined();

    // Society admin /users list also never exposes password_hash
    const socAdminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'society.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    const usersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${socAdminLogin.body.token}`);
    expect(usersRes.status).toBe(200);
    for (const u of usersRes.body.users) {
      expect(u.password_hash).toBeUndefined();
    }
  });

  it('enforces customer isolation across parcels, bookings (create/reschedule/cancel), and return requests', async () => {
    const regB = await request(app).post('/api/v1/auth/register').send({
      email: 'custb@example.com',
      password: 'Password123!',
      fullName: 'Customer B',
      societyId: repo.memory.societies[0].id,
    });
    const tokenB = regB.body.token;

    const custAParcelId = repo.memory.parcels[0].id;
    const custABookingId = repo.memory.bookings[0].id;
    const slotId = repo.memory.slots[1].id;

    // Customer B cannot read Customer A parcel
    const pRes = await request(app)
      .get(`/api/v1/parcels/${custAParcelId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(pRes.status).toBe(403);

    // Customer B cannot book a slot for Customer A's parcel (Booking IDOR)
    const bookIdorRes = await request(app)
      .post('/api/v1/delivery-bookings')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ parcelId: custAParcelId, slotId });
    expect(bookIdorRes.status).toBe(403);

    // Customer B cannot reschedule or cancel Customer A's booking
    const reschedRes = await request(app)
      .patch(`/api/v1/delivery-bookings/${custABookingId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ slotId });
    expect(reschedRes.status).toBe(404);

    const cancelRes = await request(app)
      .delete(`/api/v1/delivery-bookings/${custABookingId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(cancelRes.status).toBe(403);

    // Customer B cannot create return request for Customer A's parcel
    const rRes = await request(app)
      .post('/api/v1/customer/returns')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ parcelId: custAParcelId, reason: 'Unauthorized return' });
    expect(rRes.status).toBe(403);
  });

  it('scopes society_admin and hub_manager to their own society and restricts super_admin endpoints', async () => {
    const society2Id = repo.memory.societies[1].id;
    const hub2Id = repo.memory.hubs[1].id;

    const soc1AdminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'society.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    const soc1Token = soc1AdminLogin.body.token;

    const hub1ManagerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'hub.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    const hub1Token = hub1ManagerLogin.body.token;

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

    // Neither Society 1 admin nor Hub 1 manager can read or update Society 2 parcel
    for (const tok of [soc1Token, hub1Token]) {
      const readRes = await request(app).get(`/api/v1/parcels/${soc2Parcel.id}`).set('Authorization', `Bearer ${tok}`);
      expect(readRes.status).toBe(403);

      const updateRes = await request(app)
        .patch(`/api/v1/parcels/${soc2Parcel.id}/status`)
        .set('Authorization', `Bearer ${tok}`)
        .send({ status: 'Received at hub' });
      expect(updateRes.status).toBe(403);
    }

    const logsRes = await request(app).get('/api/v1/admin/audit-logs').set('Authorization', `Bearer ${soc1Token}`);
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

  it('verifies migration 0002 SQL security controls (column grants, triggers, scoping, recursion helper)', () => {
    const sqlPath = path.resolve(__dirname, '../../../database/migrations/202611250002_rls_policies.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Profile column-level SELECT excludes password_hash, auth_user_id, and email for PUBLIC, anon & authenticated
    expect(sql).toContain('REVOKE SELECT ON public.profiles FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain('ON public.profiles TO authenticated;');
    const selectGrantStart = sql.indexOf('REVOKE SELECT ON public.profiles FROM PUBLIC, anon, authenticated;');
    const selectGrantEnd = sql.indexOf('ON public.profiles TO authenticated;');
    const selectGrantBlock = sql.slice(selectGrantStart, selectGrantEnd);
    expect(selectGrantBlock).not.toContain('password_hash');
    expect(selectGrantBlock).not.toContain('auth_user_id');
    expect(selectGrantBlock).not.toContain('email');
    expect(sql).toContain("has_table_privilege('authenticated', 'public.profiles', 'SELECT')");
    expect(sql).toContain("has_column_privilege('authenticated', 'public.profiles', 'password_hash', 'SELECT')");
    expect(sql).toContain("has_column_privilege('authenticated', 'public.profiles', 'auth_user_id', 'SELECT')");
    expect(sql).toContain("has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT')");

    // Genuine JSONB allowlists in all 4 SECURITY INVOKER triggers
    const profStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()');
    const profEnd = sql.indexOf('CREATE TRIGGER trg_prevent_profile_escalation');
    const profBlock = sql.slice(profStart, profEnd);
    expect(profBlock).toContain('SECURITY INVOKER');
    expect(profBlock).not.toContain('SECURITY DEFINER');
    expect(profBlock).toContain("ARRAY['full_name', 'phone', 'flat_number', 'avatar_url', 'updated_at']");
    expect(profBlock).toContain('(to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed)');
    expect(profBlock).toContain("NULLIF(current_setting('request.jwt.claims', TRUE), '') IS NULL");

    expect(sql).toContain("ARRAY['delivery_instructions', 'updated_at']");
    expect(sql).toContain("ARRAY['reason', 'pickup_slot_date', 'pickup_window', 'updated_at']");
    expect(sql).toContain("ARRAY['subject', 'description', 'priority', 'updated_at']");

    // Notifications column-level privilege restricts authenticated UPDATE to is_read only
    expect(sql).toContain('REVOKE UPDATE ON public.notifications FROM authenticated;');
    expect(sql).toContain('GRANT UPDATE (is_read) ON public.notifications TO authenticated;');

    // Driver assignment direct UPDATE is removed; drivers have read-only access and updates go through backend service_role
    expect(sql).toContain('DROP POLICY IF EXISTS delivery_assignments_driver_update ON public.delivery_assignments;');
    expect(sql).not.toContain('CREATE POLICY delivery_assignments_driver_update');

    // Booking, return request, and support ticket customer update guards
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.enforce_booking_customer_update()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.enforce_return_request_customer_update()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.enforce_support_ticket_customer_update()');
    expect(sql).toContain('CREATE POLICY return_requests_customer_insert ON public.return_requests');
    expect(sql).toContain('CREATE POLICY support_tickets_customer_insert ON public.support_tickets');
    expect(sql).toContain('(to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed)');

    // Hub manager scoped to society via is_society_staff_of; only super_admin is global
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_super_admin()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_society_staff_of(target_society_id UUID)');
    expect(sql).not.toContain('is_global_admin');

    // Recursion helper preserved
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_driver_assigned_to_parcel(target_parcel_id UUID)');
  });

  it('requires valid OTP before Express backend updates delivery assignment or parcel status', async () => {
    const delLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'delivery.demo@parcelbridge.io',
      password: 'DemoPass@2026',
    });
    const delToken = delLogin.body.token;
    const assignedParcelId = repo.memory.parcels[1].id;

    // Missing or invalid OTP must fail and leave assignment & parcel status unchanged
    const badConfirm = await request(app)
      .post('/api/v1/delivery/confirm')
      .set('Authorization', `Bearer ${delToken}`)
      .send({ parcelId: assignedParcelId, otp: '999999' });
    expect(badConfirm.status).toBe(400);

    const parcelAfter = repo.memory.parcels.find((p) => p.id === assignedParcelId)!;
    const assignAfter = repo.memory.assignments.find((a) => a.parcel_id === assignedParcelId)!;
    expect(parcelAfter.current_status).not.toBe('Delivered');
    expect(assignAfter.status).toBe('assigned');
  });
});
