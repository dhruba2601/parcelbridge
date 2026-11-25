import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth';
import { otpRateLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import {
  assertDeliveryAssignmentOwnership,
  confirmDeliveryHandover,
  dispatchParcelAndGenerateOtp,
  listAssignmentsForActor,
  verifyDeliveryOtp,
} from '../services/deliveryService';
import { transitionParcelStatus } from '../services/parcelService';
import { dispatchSchema, failDeliverySchema, otpSchema } from '../validators/schemas';

export const deliveryRouter = Router();

deliveryRouter.get(
  '/assignments',
  authenticate,
  requireRoles('delivery_personnel', 'super_admin', 'hub_manager'),
  async (req, res, next) => {
    try {
      const assignments = await listAssignmentsForActor(req.user!);
      res.json({ assignments });
    } catch (err) {
      next(err);
    }
  }
);

deliveryRouter.post(
  '/dispatch',
  authenticate,
  requireRoles('super_admin', 'hub_manager', 'society_admin'),
  validateBody(dispatchSchema),
  async (req, res, next) => {
    try {
      const result = await dispatchParcelAndGenerateOtp(
        req.body.parcelId,
        req.body.personnelId,
        req.user!,
        req.body.routeNotes
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

deliveryRouter.post(
  '/verify-otp',
  authenticate,
  otpRateLimiter,
  requireRoles('delivery_personnel', 'super_admin', 'hub_manager'),
  validateBody(otpSchema),
  async (req, res, next) => {
    try {
      const result = await verifyDeliveryOtp(req.body.parcelId, req.body.otp, req.user!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

deliveryRouter.post(
  '/confirm',
  authenticate,
  otpRateLimiter,
  requireRoles('delivery_personnel', 'super_admin', 'hub_manager'),
  validateBody(otpSchema),
  async (req, res, next) => {
    try {
      const result = await confirmDeliveryHandover(req.body.parcelId, req.body.otp, req.user!, req.body.notes);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

deliveryRouter.post(
  '/fail',
  authenticate,
  requireRoles('delivery_personnel', 'super_admin', 'hub_manager'),
  validateBody(failDeliverySchema),
  async (req, res, next) => {
    try {
      await assertDeliveryAssignmentOwnership(req.body.parcelId, req.user!);
      const parcel = await transitionParcelStatus(
        req.body.parcelId,
        'Delivery attempted',
        req.user!,
        `Delivery attempt failed: ${req.body.reason}`
      );
      res.json({ parcel });
    } catch (err) {
      next(err);
    }
  }
);
