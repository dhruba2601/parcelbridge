import { z } from 'zod';
import { ALL_PARCEL_STATUSES } from '../utils/parcelStateMachine';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(20).optional(),
  societyId: z.string().uuid().optional(),
  flatNumber: z.string().max(30).optional(),
  role: z.enum(['customer', 'business_partner']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(7).max(20).optional(),
  societyId: z.string().uuid().optional(),
  flatNumber: z.string().max(30).optional(),
});

export const createParcelSchema = z.object({
  externalTrackingId: z.string().min(3).max(80),
  customerId: z.string().uuid(),
  societyId: z.string().uuid(),
  hubId: z.string().uuid(),
  courierName: z.string().min(2).max(80),
  ecommercePlatform: z.string().max(80).optional(),
  description: z.string().min(2).max(300),
  weightKg: z.number().min(0).max(500).optional(),
  storageLocation: z.string().max(60).optional(),
  initialStatus: z.enum(ALL_PARCEL_STATUSES as [string, ...string[]]).optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(ALL_PARCEL_STATUSES as [string, ...string[]]),
  notes: z.string().max(300).optional(),
  storageLocation: z.string().max(60).optional(),
});

export const scanQrSchema = z.object({
  qrToken: z.string().min(10),
});

export const createBookingSchema = z.object({
  parcelId: z.string().uuid(),
  slotId: z.string().uuid(),
  deliveryInstructions: z.string().max(300).optional(),
});

export const rescheduleSchema = z.object({
  slotId: z.string().uuid(),
  deliveryInstructions: z.string().max(300).optional(),
});

export const createSlotSchema = z.object({
  hubId: z.string().uuid(),
  societyId: z.string().uuid(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  timezone: z.string().default('Asia/Kolkata'),
  maxCapacity: z.number().int().min(1).max(500),
  staffAvailable: z.number().int().min(1).max(100).default(2),
});

export const dispatchSchema = z.object({
  parcelId: z.string().uuid(),
  personnelId: z.string().uuid(),
  routeNotes: z.string().max(250).optional(),
});

export const otpSchema = z.object({
  parcelId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
  notes: z.string().max(250).optional(),
});

export const failDeliverySchema = z.object({
  parcelId: z.string().uuid(),
  reason: z.string().min(3).max(250),
});

export const applyPartnerSchema = z.object({
  companyName: z.string().min(2).max(150),
  partnerType: z.enum(['ecommerce', 'courier', 'logistics_operator', 'property_management', 'residential_society']),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7).max(25),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  monthlyParcelVolume: z.number().int().min(0).default(0),
  message: z.string().max(1000).optional(),
});
