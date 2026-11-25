import { Router } from 'express';
import { z } from 'zod';
import { repo } from '../db/repository';
import { validateBody } from '../middleware/validate';
import { verifyPartnerWebhook } from '../middleware/webhookAuth';

export const webhooksRouter = Router();

const webhookEventSchema = z.object({
  partnerCode: z.string().min(2).max(40),
  externalTrackingId: z.string().min(3).max(80),
  eventType: z.enum(['parcel.dispatched', 'parcel.arrived_at_gate', 'parcel.cancelled']),
  occurredAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

webhooksRouter.post('/courier-event', verifyPartnerWebhook, validateBody(webhookEventSchema), async (req, res, next) => {
  try {
    await repo.addAuditLog({
      actor_id: null,
      actor_role: 'business_partner',
      action: `WEBHOOK_${req.body.eventType.toUpperCase()}`,
      entity_type: 'webhook_event',
      entity_id: req.body.externalTrackingId,
      ip_address: req.ip ?? null,
      details: req.body,
    });

    res.status(202).json({
      accepted: true,
      message: 'Partner webhook event verified and queued',
      externalTrackingId: req.body.externalTrackingId,
    });
  } catch (err) {
    next(err);
  }
});
