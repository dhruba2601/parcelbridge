export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

if (
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1' &&
  !process.env.NEXT_PUBLIC_API_URL
) {
  console.warn('PARCELBRIDGE: NEXT_PUBLIC_API_URL is not configured for this production host.');
}

export type UserRole =
  | 'super_admin'
  | 'society_admin'
  | 'hub_manager'
  | 'delivery_personnel'
  | 'customer'
  | 'business_partner';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role_code: UserRole;
  society_id: string | null;
  flat_number: string | null;
  is_demo: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'Request failed', data.code);
  }
  return data as T;
}
