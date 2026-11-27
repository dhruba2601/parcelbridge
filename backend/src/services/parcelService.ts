import QRCode from 'qrcode';
import { repo } from '../db/repository';
import { AppError } from '../middleware/errorHandler';
import { AuthTokenPayload, Parcel, ParcelEvent, ParcelStatus } from '../types';
import { verifyParcelQrToken } from '../utils/crypto';
import { canTransitionParcelStatus } from '../utils/parcelStateMachine';

export async function createParcelRecord(
  input: {
    externalTrackingId: string;
    customerId: string;
    societyId: string;
    hubId: string;
    courierName: string;
    ecommercePlatform?: string;
    description: string;
    weightKg?: number;
    storageLocation?: string;
    initialStatus?: ParcelStatus;
  },
  actor: AuthTokenPayload
): Promise<Parcel> {
  const customer = await repo.findProfileById(input.customerId);
  if (!customer) {
    throw new AppError(404, 'Target customer profile not found', 'CUSTOMER_NOT_FOUND');
  }

  const code = `PB-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  const status: ParcelStatus = input.initialStatus ?? 'Received at hub';

  const parcel = await repo.createParcel({
    internal_parcel_code: code,
    external_tracking_id: input.externalTrackingId,
    customer_id: input.customerId,
    society_id: input.societyId,
    unit_id: customer.unit_id,
    hub_id: input.hubId,
    courier_name: input.courierName,
    ecommerce_platform: input.ecommercePlatform ?? null,
    description: input.description,
    weight_kg: input.weightKg ?? null,
    storage_location: input.storageLocation ?? null,
    current_status: status,
    arrived_at: status === 'Expected' ? null : new Date().toISOString(),
    delivered_at: null,
    is_demo: customer.is_demo,
  });

  await repo.addParcelEvent({
    parcel_id: parcel.id,
    previous_status: null,
    new_status: status,
    actor_id: actor.sub,
    actor_role: actor.role,
    location: input.storageLocation ?? input.hubId,
    notes: 'Parcel registered in PARCELBRIDGE',
  });

  await repo.addNotification({
    recipient_id: customer.id,
    parcel_id: parcel.id,
    title: 'New Parcel Registered',
    message: `Parcel ${parcel.internal_parcel_code} (${parcel.courier_name}) is now "${status}".`,
    category: 'parcel_update',
  });

  return parcel;
}

export async function transitionParcelStatus(
  parcelId: string,
  newStatus: ParcelStatus,
  actor: AuthTokenPayload,
  notes?: string,
  storageLocation?: string
): Promise<Parcel> {
  const parcel = await repo.findParcelById(parcelId);
  if (!parcel) {
    throw new AppError(404, 'Parcel not found', 'NOT_FOUND');
  }

  if (actor.role === 'society_admin' && actor.societyId && parcel.society_id !== actor.societyId) {
    throw new AppError(403, 'Society admin cannot modify parcels in another society', 'FORBIDDEN');
  }

  if (!canTransitionParcelStatus(parcel.current_status, newStatus)) {
    throw new AppError(
      400,
      `Invalid parcel status transition from "${parcel.current_status}" to "${newStatus}"`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const patch: Partial<Parcel> = {
    current_status: newStatus,
    ...(storageLocation ? { storage_location: storageLocation } : {}),
    ...(newStatus === 'Received at hub' && !parcel.arrived_at ? { arrived_at: new Date().toISOString() } : {}),
    ...(newStatus === 'Delivered' ? { delivered_at: new Date().toISOString() } : {}),
  };

  const updated = await repo.updateParcel(parcel.id, patch);

  await repo.addParcelEvent({
    parcel_id: parcel.id,
    previous_status: parcel.current_status,
    new_status: newStatus,
    actor_id: actor.sub,
    actor_role: actor.role,
    location: storageLocation ?? parcel.storage_location ?? parcel.hub_id,
    notes: notes ?? `Status updated to ${newStatus}`,
  });

  await repo.addNotification({
    recipient_id: parcel.customer_id,
    parcel_id: parcel.id,
    title: `Parcel ${parcel.internal_parcel_code}: ${newStatus}`,
    message: notes ?? `Your parcel status has been updated to ${newStatus}.`,
    category: 'parcel_update',
  });

  return updated;
}

export async function getParcelWithHistory(parcelId: string, actor: AuthTokenPayload): Promise<{ parcel: Parcel; events: ParcelEvent[]; qrDataUrl: string }> {
  const parcel = await repo.findParcelById(parcelId);
  if (!parcel) {
    throw new AppError(404, 'Parcel not found', 'NOT_FOUND');
  }

  if (actor.role === 'society_admin' && actor.societyId && parcel.society_id !== actor.societyId) {
    throw new AppError(403, 'Society admin cannot modify parcels in another society', 'FORBIDDEN');
  }

  if (actor.role === 'customer' && parcel.customer_id !== actor.sub) {
    throw new AppError(403, 'You can only access your own parcels', 'FORBIDDEN');
  }

  if (actor.role === 'society_admin' && actor.societyId && parcel.society_id !== actor.societyId) {
    throw new AppError(403, 'Parcel belongs to a different residential society', 'FORBIDDEN');
  }

  const events = await repo.listParcelEvents(parcel.id);
  const qrDataUrl = await QRCode.toDataURL(parcel.qr_token, { width: 220, margin: 1 });

  return { parcel, events, qrDataUrl };
}

export async function scanParcelQrToken(qrToken: string, actor: AuthTokenPayload): Promise<Parcel> {
  const check = verifyParcelQrToken(qrToken);
  if (!check.valid || !check.parcelId) {
    throw new AppError(400, 'Invalid or tampered parcel QR code', 'INVALID_QR_TOKEN');
  }

  const parcel = await repo.findParcelById(check.parcelId);
  if (!parcel) {
    throw new AppError(404, 'Parcel referenced by QR code does not exist', 'NOT_FOUND');
  }

  if (['Expected', 'Received at hub'].includes(parcel.current_status)) {
    return transitionParcelStatus(parcel.id, 'Scanned', actor, 'QR code scanned at parcel hub');
  }
  return parcel;
}
