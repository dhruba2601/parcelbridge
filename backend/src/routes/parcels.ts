import { Router } from 'express';
import {
  createParcelController,
  getParcelController,
  listParcelsController,
  scanQrController,
  trackParcelController,
  updateParcelStatusController,
} from '../controllers/parcelController';
import { authenticate, requireRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createParcelSchema, scanQrSchema, statusUpdateSchema } from '../validators/schemas';

export const parcelsRouter = Router();

parcelsRouter.get('/track/:trackingId', trackParcelController);
parcelsRouter.get('/', authenticate, listParcelsController);
parcelsRouter.post(
  '/',
  authenticate,
  requireRoles('super_admin', 'hub_manager', 'society_admin'),
  validateBody(createParcelSchema),
  createParcelController
);
parcelsRouter.post(
  '/scan-qr',
  authenticate,
  requireRoles('super_admin', 'hub_manager', 'society_admin', 'delivery_personnel'),
  validateBody(scanQrSchema),
  scanQrController
);
parcelsRouter.get('/:id', authenticate, getParcelController);
parcelsRouter.patch(
  '/:id/status',
  authenticate,
  requireRoles('super_admin', 'hub_manager', 'society_admin', 'delivery_personnel'),
  validateBody(statusUpdateSchema),
  updateParcelStatusController
);
