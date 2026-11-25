import { Router } from 'express';
import { repo } from '../db/repository';
import { authenticate, requireRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createBookingSchema, createSlotSchema, rescheduleSchema } from '../validators/schemas';

export const schedulingRouter = Router();

schedulingRouter.get('/delivery-slots', async (req, res, next) => {
  try {
    const societyId = typeof req.query.societyId === 'string' ? req.query.societyId : undefined;
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const slots = await repo.listSlots({ societyId, date });
    res.json({ slots });
  } catch (err) {
    next(err);
  }
});

schedulingRouter.post(
  '/delivery-slots',
  authenticate,
  requireRoles('super_admin', 'hub_manager', 'society_admin'),
  validateBody(createSlotSchema),
  async (req, res, next) => {
    try {
      const slot = await repo.createSlot({
        hub_id: req.body.hubId,
        society_id: req.body.societyId,
        slot_date: req.body.slotDate,
        start_time: req.body.startTime,
        end_time: req.body.endTime,
        timezone: req.body.timezone,
        max_capacity: req.body.maxCapacity,
        staff_available: req.body.staffAvailable,
        is_active: true,
        is_demo: false,
      });
      res.status(201).json({ slot });
    } catch (err) {
      next(err);
    }
  }
);

schedulingRouter.get('/delivery-bookings', authenticate, async (req, res, next) => {
  try {
    const isAdmin = ['super_admin', 'hub_manager', 'society_admin'].includes(req.user!.role);
    const bookings = await repo.listBookings(isAdmin ? undefined : req.user!.sub);
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
});

schedulingRouter.post(
  '/delivery-bookings',
  authenticate,
  validateBody(createBookingSchema),
  async (req, res, next) => {
    try {
      const result = await repo.reserveSlotAtomic({
        parcelId: req.body.parcelId,
        customerId: req.user!.sub,
        slotId: req.body.slotId,
        instructions: req.body.deliveryInstructions,
      });
      res.status(201).json({ booking: result });
    } catch (err) {
      next(err);
    }
  }
);

schedulingRouter.patch(
  '/delivery-bookings/:id',
  authenticate,
  validateBody(rescheduleSchema),
  async (req, res, next) => {
    try {
      const bookings = await repo.listBookings(req.user!.sub);
      const target = bookings.find((b) => b.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'Booking not found', code: 'NOT_FOUND' });
        return;
      }
      const result = await repo.reserveSlotAtomic({
        parcelId: target.parcel_id,
        customerId: req.user!.sub,
        slotId: req.body.slotId,
        instructions: req.body.deliveryInstructions,
      });
      res.json({ booking: result });
    } catch (err) {
      next(err);
    }
  }
);

schedulingRouter.delete('/delivery-bookings/:id', authenticate, async (req, res, next) => {
  try {
    const isAdmin = ['super_admin', 'hub_manager', 'society_admin'].includes(req.user!.role);
    const booking = await repo.cancelBookingAtomic(String(req.params.id), req.user!.sub, isAdmin);
    res.json({ booking });
  } catch (err) {
    next(err);
  }
});
