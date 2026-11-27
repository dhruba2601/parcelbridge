import { Request, Response, NextFunction } from 'express';
import { repo } from '../db/repository';
import {
  createParcelRecord,
  getParcelWithHistory,
  scanParcelQrToken,
  transitionParcelStatus,
} from '../services/parcelService';

export async function trackParcelController(req: Request, res: Response, next: NextFunction) {
  try {
    const parcel = await repo.findParcelByTracking(String(req.params.trackingId));
    if (!parcel) {
      res.status(404).json({ error: 'Parcel not found for tracking ID', code: 'NOT_FOUND' });
      return;
    }
    const events = await repo.listParcelEvents(parcel.id);
    res.json({
      tracking: {
        internalParcelCode: parcel.internal_parcel_code,
        externalTrackingId: parcel.external_tracking_id,
        courierName: parcel.courier_name,
        currentStatus: parcel.current_status,
        arrivedAt: parcel.arrived_at,
        deliveredAt: parcel.delivered_at,
        events: events.map((e) => ({
          newStatus: e.new_status,
          location: e.location,
          notes: e.notes,
          createdAt: e.created_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listParcelsController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const filter =
      user.role === 'customer'
        ? { customerId: user.sub }
        : (user.role === 'society_admin' || user.role === 'hub_manager') && user.societyId
          ? { societyId: user.societyId }
          : undefined;
    const parcels = await repo.listParcels(filter);
    res.json({ parcels });
  } catch (err) {
    next(err);
  }
}

export async function createParcelController(req: Request, res: Response, next: NextFunction) {
  try {
    const parcel = await createParcelRecord(req.body, req.user!);
    res.status(201).json({ parcel });
  } catch (err) {
    next(err);
  }
}

export async function scanQrController(req: Request, res: Response, next: NextFunction) {
  try {
    const parcel = await scanParcelQrToken(req.body.qrToken, req.user!);
    res.json({ parcel });
  } catch (err) {
    next(err);
  }
}

export async function getParcelController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getParcelWithHistory(String(req.params.id), req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateParcelStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const parcel = await transitionParcelStatus(
      String(req.params.id),
      req.body.status,
      req.user!,
      req.body.notes,
      req.body.storageLocation
    );
    res.json({ parcel });
  } catch (err) {
    next(err);
  }
}
