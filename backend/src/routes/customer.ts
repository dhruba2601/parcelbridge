import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { env } from '../config/env';
import { getSupabaseAdmin } from '../config/supabase';
import { repo } from '../db/repository';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { ReturnRequest, SupportTicket } from '../types';

export const customerRouter = Router();

const returnSchema = z.object({
  parcelId: z.string().uuid(),
  reason: z.string().min(3).max(400),
  pickupSlotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pickupWindow: z.string().max(50).optional(),
});

const ticketSchema = z.object({
  parcelId: z.string().uuid().optional(),
  subject: z.string().min(3).max(150),
  description: z.string().min(5).max(1500),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

customerRouter.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const notifications = await repo.listNotifications(req.user!.sub);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

customerRouter.get('/returns', authenticate, async (req, res, next) => {
  try {
    if (env.storageDriver === 'supabase') {
      const { data } = await getSupabaseAdmin()
        .from('return_requests')
        .select('*')
        .eq('customer_id', req.user!.sub)
        .order('created_at', { ascending: false });
      res.json({ returns: data ?? [] });
      return;
    }
    res.json({ returns: repo.memory.returns.filter((r) => r.customer_id === req.user!.sub) });
  } catch (err) {
    next(err);
  }
});

customerRouter.post('/returns', authenticate, validateBody(returnSchema), async (req, res, next) => {
  try {
    const parcel = await repo.findParcelById(req.body.parcelId);
    if (!parcel || parcel.customer_id !== req.user!.sub) {
      res.status(403).json({ error: 'Parcel not found or not owned by customer', code: 'FORBIDDEN' });
      return;
    }
    const record: ReturnRequest = {
      id: uuidv4(),
      parcel_id: parcel.id,
      customer_id: req.user!.sub,
      reason: req.body.reason,
      pickup_slot_date: req.body.pickupSlotDate ?? null,
      pickup_window: req.body.pickupWindow ?? null,
      status: 'requested',
      is_demo: parcel.is_demo,
      created_at: new Date().toISOString(),
    };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('return_requests').insert(record).select('*').single();
      if (error) throw error;
      res.status(201).json({ returnRequest: data });
      return;
    }
    repo.memory.returns.unshift(record);
    res.status(201).json({ returnRequest: record });
  } catch (err) {
    next(err);
  }
});

customerRouter.get('/support-tickets', authenticate, async (req, res, next) => {
  try {
    if (env.storageDriver === 'supabase') {
      const { data } = await getSupabaseAdmin()
        .from('support_tickets')
        .select('*')
        .eq('customer_id', req.user!.sub)
        .order('created_at', { ascending: false });
      res.json({ tickets: data ?? [] });
      return;
    }
    res.json({ tickets: repo.memory.tickets.filter((t) => t.customer_id === req.user!.sub) });
  } catch (err) {
    next(err);
  }
});

customerRouter.post('/support-tickets', authenticate, validateBody(ticketSchema), async (req, res, next) => {
  try {
    const record: SupportTicket = {
      id: uuidv4(),
      customer_id: req.user!.sub,
      parcel_id: req.body.parcelId ?? null,
      subject: req.body.subject,
      description: req.body.description,
      priority: req.body.priority,
      status: 'open',
      resolution_notes: null,
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('support_tickets').insert(record).select('*').single();
      if (error) throw error;
      res.status(201).json({ ticket: data });
      return;
    }
    repo.memory.tickets.unshift(record);
    res.status(201).json({ ticket: record });
  } catch (err) {
    next(err);
  }
});
