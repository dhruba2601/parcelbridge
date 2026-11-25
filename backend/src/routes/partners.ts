import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { env } from '../config/env';
import { getSupabaseAdmin } from '../config/supabase';
import { repo } from '../db/repository';
import { authenticate, requireRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { BusinessPartner } from '../types';

export const partnersRouter = Router();

const applySchema = z.object({
  companyName: z.string().min(2).max(150),
  partnerType: z.enum(['ecommerce', 'courier', 'logistics_operator', 'property_management', 'residential_society']),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7).max(25),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  monthlyParcelVolume: z.number().int().min(0).default(0),
  message: z.string().max(1000).optional(),
});

partnersRouter.post('/apply', validateBody(applySchema), async (req, res, next) => {
  try {
    const record: BusinessPartner = {
      id: uuidv4(),
      profile_id: null,
      company_name: req.body.companyName,
      partner_type: req.body.partnerType,
      contact_name: req.body.contactName,
      contact_email: req.body.contactEmail,
      contact_phone: req.body.contactPhone,
      website_url: req.body.websiteUrl || null,
      monthly_parcel_volume: req.body.monthlyParcelVolume,
      message: req.body.message ?? null,
      status: 'pending',
      is_demo: false,
      created_at: new Date().toISOString(),
    };

    if (env.storageDriver === 'supabase') {
      const { data, error } = await getSupabaseAdmin().from('business_partners').insert(record).select('*').single();
      if (error) throw error;
      res.status(201).json({ application: data });
      return;
    }

    repo.memory.partners.unshift(record);
    res.status(201).json({ application: record });
  } catch (err) {
    next(err);
  }
});

partnersRouter.get(
  '/applications',
  authenticate,
  requireRoles('super_admin', 'business_partner'),
  async (req, res, next) => {
    try {
      if (env.storageDriver === 'supabase') {
        let q = getSupabaseAdmin().from('business_partners').select('*').order('created_at', { ascending: false });
        if (req.user!.role === 'business_partner') {
          q = q.eq('profile_id', req.user!.sub);
        }
        const { data, error } = await q;
        if (error) throw error;
        res.json({ applications: data });
        return;
      }

      const list =
        req.user!.role === 'business_partner'
          ? repo.memory.partners.filter((p) => p.profile_id === req.user!.sub)
          : repo.memory.partners;
      res.json({ applications: list });
    } catch (err) {
      next(err);
    }
  }
);
