import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { getSupabaseAdmin } from '../config/supabase';
import { repo } from '../db/repository';
import { authenticate, requireRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAdminDashboardMetrics } from '../services/adminService';

export const adminRouter = Router();

const createSocietySchema = z.object({
  name: z.string().min(2).max(150),
  code: z.string().min(2).max(30),
  addressLine1: z.string().min(3).max(200),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  postalCode: z.string().min(4).max(20),
  timezone: z.string().default('Asia/Kolkata'),
  totalUnits: z.number().int().min(1).default(100),
});

const createHubSchema = z.object({
  societyId: z.string().uuid().nullable().optional(),
  name: z.string().min(2).max(150),
  code: z.string().min(2).max(30),
  locationDescription: z.string().max(250).optional(),
  capacity: z.number().int().min(10).default(500),
  operatingHours: z.string().default('07:00 - 22:00'),
});

// Publicly readable societies list for registration dropdown
adminRouter.get('/societies/public', async (_req, res, next) => {
  try {
    const societies = await repo.listSocieties();
    res.json({ societies });
  } catch (err) {
    next(err);
  }
});

adminRouter.get(
  '/dashboard',
  authenticate,
  requireRoles('super_admin', 'society_admin', 'hub_manager'),
  async (_req, res, next) => {
    try {
      const data = await getAdminDashboardMetrics();
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.get(
  '/analytics',
  authenticate,
  requireRoles('super_admin', 'society_admin', 'hub_manager'),
  async (_req, res, next) => {
    try {
      const data = await getAdminDashboardMetrics();
      res.json({ analytics: data.metrics });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.get(
  '/users',
  authenticate,
  requireRoles('super_admin', 'society_admin'),
  async (_req, res, next) => {
    try {
      const users = await repo.listProfiles();
      res.json({ users });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.get(
  '/audit-logs',
  authenticate,
  requireRoles('super_admin'),
  async (_req, res, next) => {
    try {
      if (env.storageDriver === 'supabase') {
        const { data } = await getSupabaseAdmin().from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
        res.json({ logs: data ?? [] });
        return;
      }
      res.json({ logs: repo.memory.auditLogs.slice(0, 100) });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.post(
  '/societies',
  authenticate,
  requireRoles('super_admin', 'society_admin'),
  validateBody(createSocietySchema),
  async (req, res, next) => {
    try {
      const society = await repo.createSociety({
        name: req.body.name,
        code: req.body.code,
        address_line1: req.body.addressLine1,
        city: req.body.city,
        state: req.body.state,
        postal_code: req.body.postalCode,
        timezone: req.body.timezone,
        total_units: req.body.totalUnits,
        is_active: true,
        is_demo: false,
      });
      res.status(201).json({ society });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.post(
  '/hubs',
  authenticate,
  requireRoles('super_admin', 'hub_manager'),
  validateBody(createHubSchema),
  async (req, res, next) => {
    try {
      const hub = await repo.createHub({
        society_id: req.body.societyId ?? null,
        name: req.body.name,
        code: req.body.code,
        location_description: req.body.locationDescription ?? null,
        capacity: req.body.capacity,
        current_occupancy: 0,
        operating_hours: req.body.operatingHours,
        is_active: true,
        is_demo: false,
      });
      res.status(201).json({ hub });
    } catch (err) {
      next(err);
    }
  }
);
