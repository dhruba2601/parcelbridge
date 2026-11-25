import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { repo, toSafeProfile } from '../db/repository';
import { AppError } from '../middleware/errorHandler';
import { AuthTokenPayload, SafeProfile, UserRole } from '../types';

export async function registerUser(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  societyId?: string;
  flatNumber?: string;
  role?: UserRole;
}): Promise<{ token: string; user: SafeProfile }> {
  const existing = await repo.findProfileByEmail(input.email);
  if (existing) {
    throw new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS');
  }

  // Public registration can only create customer or business_partner accounts
  const allowedPublicRoles: UserRole[] = ['customer', 'business_partner'];
  const role: UserRole = input.role && allowedPublicRoles.includes(input.role) ? input.role : 'customer';

  const passwordHash = await bcrypt.hash(input.password, 12);
  const profile = await repo.createProfile({
    email: input.email,
    password_hash: passwordHash,
    full_name: input.fullName,
    phone: input.phone ?? null,
    role_code: role,
    society_id: input.societyId ?? null,
    unit_id: null,
    flat_number: input.flatNumber ?? null,
    is_active: true,
    is_demo: false,
  });

  await repo.addAuditLog({
    actor_id: profile.id,
    actor_role: profile.role_code,
    action: 'USER_REGISTERED',
    entity_type: 'profile',
    entity_id: profile.id,
    ip_address: null,
    details: { role: profile.role_code },
  });

  const token = signAuthToken({
    sub: profile.id,
    email: profile.email,
    role: profile.role_code,
    societyId: profile.society_id,
  });

  return { token, user: toSafeProfile(profile) };
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: SafeProfile }> {
  const profile = await repo.findProfileByEmail(email);
  if (!profile || !profile.is_active) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, profile.password_hash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  await repo.addAuditLog({
    actor_id: profile.id,
    actor_role: profile.role_code,
    action: 'USER_LOGIN',
    entity_type: 'profile',
    entity_id: profile.id,
    ip_address: null,
    details: {},
  });

  const token = signAuthToken({
    sub: profile.id,
    email: profile.email,
    role: profile.role_code,
    societyId: profile.society_id,
  });

  return { token, user: toSafeProfile(profile) };
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}
