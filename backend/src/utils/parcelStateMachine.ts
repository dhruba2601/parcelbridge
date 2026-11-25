import { ParcelStatus } from '../types';

export const ALL_PARCEL_STATUSES: ParcelStatus[] = [
  'Expected',
  'Received at hub',
  'Scanned',
  'Verified',
  'Stored',
  'Ready for delivery',
  'Delivery scheduled',
  'Out for delivery',
  'Delivered',
  'Delivery attempted',
  'Returned',
  'Cancelled',
];

const ALLOWED_TRANSITIONS: Record<ParcelStatus, ParcelStatus[]> = {
  'Expected': ['Received at hub', 'Cancelled'],
  'Received at hub': ['Scanned', 'Verified', 'Returned', 'Cancelled'],
  'Scanned': ['Verified', 'Stored', 'Returned', 'Cancelled'],
  'Verified': ['Stored', 'Ready for delivery', 'Returned', 'Cancelled'],
  'Stored': ['Ready for delivery', 'Delivery scheduled', 'Returned', 'Cancelled'],
  'Ready for delivery': ['Delivery scheduled', 'Out for delivery', 'Returned', 'Cancelled'],
  'Delivery scheduled': ['Out for delivery', 'Ready for delivery', 'Cancelled'],
  'Out for delivery': ['Delivered', 'Delivery attempted', 'Returned'],
  'Delivery attempted': ['Delivery scheduled', 'Out for delivery', 'Stored', 'Returned', 'Cancelled'],
  'Delivered': ['Returned'],
  'Returned': [],
  'Cancelled': [],
};

export function canTransitionParcelStatus(from: ParcelStatus, to: ParcelStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedNextStatuses(current: ParcelStatus): ParcelStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}
