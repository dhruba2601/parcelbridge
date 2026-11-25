import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { getSupabaseAdmin } from '../config/supabase';
import { repo } from '../db/repository';
import { AppError } from '../middleware/errorHandler';
import { AuthTokenPayload, DeliveryAssignment, OtpVerification } from '../types';
import { generateOtpPair, verifyOtpHash } from '../utils/crypto';
import { transitionParcelStatus } from './parcelService';

export async function dispatchParcelAndGenerateOtp(
  parcelId: string,
  personnelId: string,
  actor: AuthTokenPayload,
  routeNotes?: string
): Promise<{ assignment: DeliveryAssignment; demoOtpPreview?: string; expiresAt: string }> {
  const parcel = await repo.findParcelById(parcelId);
  if (!parcel) throw new AppError(404, 'Parcel not found', 'NOT_FOUND');

  // Generate OTP pair (hashed for storage, plaintext only for notification/demo)
  const { otp, otpHash } = generateOtpPair();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  let assignment: DeliveryAssignment;
  const otpRecord: OtpVerification = {
    id: uuidv4(),
    parcel_id: parcel.id,
    customer_id: parcel.customer_id,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempts: 0,
    max_attempts: 5,
    verified_at: null,
    verified_by: null,
    is_invalidated: false,
    created_at: now,
  };

  if (env.storageDriver === 'supabase') {
    const sb = getSupabaseAdmin();
    await sb
      .from('otp_verifications')
      .update({ is_invalidated: true })
      .eq('parcel_id', parcel.id)
      .is('verified_at', null);

    await sb.from('otp_verifications').insert(otpRecord);

    const { data: createdAssign, error } = await sb
      .from('delivery_assignments')
      .insert({
        id: uuidv4(),
        parcel_id: parcel.id,
        booking_id: null,
        personnel_id: personnelId,
        assigned_by: actor.sub,
        route_sequence: 1,
        route_notes: routeNotes ?? null,
        status: 'in_progress',
        failure_reason: null,
        completed_at: null,
        is_demo: parcel.is_demo,
        created_at: now,
      })
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message, 'ASSIGNMENT_FAILED');
    assignment = createdAssign as DeliveryAssignment;
  } else {
    repo.memory.otps.forEach((o) => {
      if (o.parcel_id === parcel.id && !o.verified_at) o.is_invalidated = true;
    });
    repo.memory.otps.unshift(otpRecord);

    assignment = {
      id: uuidv4(),
      parcel_id: parcel.id,
      booking_id: null,
      personnel_id: personnelId,
      assigned_by: actor.sub,
      route_sequence: 1,
      route_notes: routeNotes ?? null,
      status: 'in_progress',
      failure_reason: null,
      completed_at: null,
      is_demo: parcel.is_demo,
      created_at: now,
    };
    repo.memory.assignments.unshift(assignment);
  }

  await transitionParcelStatus(parcel.id, 'Out for delivery', actor, 'Dispatched with delivery personnel');

  await repo.addNotification({
    recipient_id: parcel.customer_id,
    parcel_id: parcel.id,
    title: `Delivery OTP for ${parcel.internal_parcel_code}`,
    message: `Your parcel is out for delivery. Share OTP ${otp} with the delivery executive at handover (valid 30 mins).`,
    category: 'otp_alert',
  });

  return {
    assignment,
    ...(env.demoMode ? { demoOtpPreview: otp } : {}),
    expiresAt,
  };
}

export async function assertDeliveryAssignmentOwnership(parcelId: string, actor: AuthTokenPayload): Promise<void> {
  if (actor.role !== 'delivery_personnel') return;

  if (env.storageDriver === 'supabase') {
    const { data, error } = await getSupabaseAdmin()
      .from('delivery_assignments')
      .select('id, delivery_personnel!inner(profile_id)')
      .eq('parcel_id', parcelId)
      .eq('delivery_personnel.profile_id', actor.sub)
      .in('status', ['assigned', 'in_progress'])
      .limit(1);
    if (error || !data || data.length === 0) {
      throw new AppError(403, 'You are not assigned to this parcel delivery', 'FORBIDDEN_ASSIGNMENT');
    }
    return;
  }

  const personnel = repo.memory.personnel.find((p) => p.profile_id === actor.sub);
  const assigned =
    personnel &&
    repo.memory.assignments.some(
      (a) =>
        a.parcel_id === parcelId &&
        a.personnel_id === personnel.id &&
        (a.status === 'assigned' || a.status === 'in_progress')
    );
  if (!assigned) {
    throw new AppError(403, 'You are not assigned to this parcel delivery', 'FORBIDDEN_ASSIGNMENT');
  }
}

export async function verifyDeliveryOtp(
  parcelId: string,
  otp: string,
  actor: AuthTokenPayload
): Promise<{ verified: boolean; parcelId: string }> {
  await assertDeliveryAssignmentOwnership(parcelId, actor);
  let activeOtp: OtpVerification | undefined;

  if (env.storageDriver === 'supabase') {
    const { data } = await getSupabaseAdmin()
      .from('otp_verifications')
      .select('*')
      .eq('parcel_id', parcelId)
      .eq('is_invalidated', false)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    activeOtp = data as OtpVerification | undefined;
  } else {
    activeOtp = repo.memory.otps.find(
      (o) => o.parcel_id === parcelId && !o.is_invalidated && !o.verified_at
    );
  }

  if (!activeOtp) {
    throw new AppError(400, 'No active OTP found for this parcel', 'OTP_NOT_FOUND');
  }

  if (new Date(activeOtp.expires_at).getTime() < Date.now()) {
    throw new AppError(400, 'OTP has expired. Request a new dispatch OTP.', 'OTP_EXPIRED');
  }

  if (activeOtp.attempts >= activeOtp.max_attempts) {
    throw new AppError(429, 'Maximum OTP verification attempts exceeded', 'OTP_LOCKED');
  }

  const isMatch = verifyOtpHash(otp, activeOtp.otp_hash);
  if (!isMatch) {
    const nextAttempts = activeOtp.attempts + 1;
    if (env.storageDriver === 'supabase') {
      await getSupabaseAdmin()
        .from('otp_verifications')
        .update({ attempts: nextAttempts, is_invalidated: nextAttempts >= activeOtp.max_attempts })
        .eq('id', activeOtp.id);
    } else {
      activeOtp.attempts = nextAttempts;
      if (nextAttempts >= activeOtp.max_attempts) activeOtp.is_invalidated = true;
    }
    throw new AppError(400, `Invalid OTP. ${activeOtp.max_attempts - nextAttempts} attempts remaining.`, 'OTP_INVALID');
  }

  const now = new Date().toISOString();
  if (env.storageDriver === 'supabase') {
    await getSupabaseAdmin()
      .from('otp_verifications')
      .update({ verified_at: now, verified_by: actor.sub })
      .eq('id', activeOtp.id);
  } else {
    activeOtp.verified_at = now;
    activeOtp.verified_by = actor.sub;
  }

  return { verified: true, parcelId };
}

export async function confirmDeliveryHandover(
  parcelId: string,
  otp: string,
  actor: AuthTokenPayload,
  notes?: string
): Promise<{ status: string; parcelId: string }> {
  await verifyDeliveryOtp(parcelId, otp, actor);
  await transitionParcelStatus(parcelId, 'Delivered', actor, notes ?? 'Delivered and confirmed via OTP handover');

  if (env.storageDriver === 'supabase') {
    await getSupabaseAdmin()
      .from('delivery_assignments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('parcel_id', parcelId)
      .in('status', ['assigned', 'in_progress']);
  } else {
    const assign = repo.memory.assignments.find(
      (a) => a.parcel_id === parcelId && (a.status === 'assigned' || a.status === 'in_progress')
    );
    if (assign) {
      assign.status = 'completed';
      assign.completed_at = new Date().toISOString();
    }
  }

  return { status: 'Delivered', parcelId };
}

export async function listAssignmentsForActor(actor: AuthTokenPayload): Promise<Array<DeliveryAssignment & { parcel?: unknown; customer?: unknown }>> {
  if (env.storageDriver === 'supabase') {
    const sb = getSupabaseAdmin();
    let query = sb.from('delivery_assignments').select('*, parcels(*), delivery_personnel!inner(profile_id)').order('created_at', { ascending: false });
    if (actor.role === 'delivery_personnel') {
      query = query.eq('delivery_personnel.profile_id', actor.sub);
    }
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message, 'DB_ERROR');
    return data as DeliveryAssignment[];
  }

  const personnel = repo.memory.personnel.find((p) => p.profile_id === actor.sub);
  const filtered =
    actor.role === 'delivery_personnel'
      ? repo.memory.assignments.filter((a) => personnel && a.personnel_id === personnel.id)
      : repo.memory.assignments;

  return filtered.map((a) => {
    const parcel = repo.memory.parcels.find((p) => p.id === a.parcel_id);
    const customer = parcel ? repo.memory.profiles.find((u) => u.id === parcel.customer_id) : undefined;
    return {
      ...a,
      parcel,
      customer: customer
        ? { id: customer.id, full_name: customer.full_name, flat_number: customer.flat_number, phone: customer.phone }
        : undefined,
    };
  });
}
