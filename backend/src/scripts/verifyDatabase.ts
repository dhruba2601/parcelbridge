import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const REQUIRED_TABLES = [
  'roles',
  'profiles',
  'societies',
  'residential_units',
  'parcel_hubs',
  'parcels',
  'parcel_events',
  'delivery_slots',
  'delivery_bookings',
  'delivery_assignments',
  'delivery_personnel',
  'otp_verifications',
  'notifications',
  'courier_partners',
  'business_partners',
  'return_requests',
  'support_tickets',
  'audit_logs',
];

async function verifySupabaseDatabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const storageDriver = process.env.STORAGE_DRIVER || 'memory';
  const demoMode = process.env.DEMO_MODE ?? 'unset';

  console.log(`Environment: NODE_ENV=${process.env.NODE_ENV || 'development'}, STORAGE_DRIVER=${storageDriver}, DEMO_MODE=${demoMode}`);

  if (storageDriver !== 'supabase') {
    console.error('ERROR: STORAGE_DRIVER must be set to "supabase" in backend/.env (refusing to fall back to memory).');
    process.exit(1);
  }

  if (
    !url ||
    !serviceKey ||
    url.includes('your-project-ref') ||
    serviceKey.includes('your-supabase-service-role-key') ||
    serviceKey.includes('YOUR_')
  ) {
    console.error('ERROR: Valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env to verify live Supabase.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Verifying 18 PARCELBRIDGE tables in Supabase...');
  const failures: string[] = [];

  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      failures.push(`Table ${table}: ${error.message}`);
    } else {
      console.log(`  [OK] ${table}`);
    }
  }

  const { data: roles, error: rolesErr } = await supabase.from('roles').select('code');
  if (rolesErr || !roles || roles.length < 6) {
    failures.push(`roles seed incomplete: found ${roles?.length ?? 0} roles (expected 6)`);
  } else {
    console.log(`  [OK] roles seeded (${roles.length} roles)`);
  }

  // Verify atomic RPC functions exist (non-destructive probe with nil UUID)
  const nilUuid = '00000000-0000-0000-0000-000000000000';
  const { error: reserveErr } = await supabase.rpc('reserve_delivery_slot', {
    p_parcel_id: nilUuid,
    p_customer_id: nilUuid,
    p_slot_id: nilUuid,
    p_instructions: null,
  });
  if (reserveErr && reserveErr.message.includes('PARCEL_NOT_FOUND')) {
    console.log('  [OK] RPC reserve_delivery_slot');
  } else {
    failures.push(`RPC reserve_delivery_slot missing or unexpected response: ${reserveErr?.message ?? 'no error'}`);
  }

  const { error: cancelErr } = await supabase.rpc('cancel_delivery_booking', {
    p_booking_id: nilUuid,
    p_actor_id: nilUuid,
    p_is_admin: false,
  });
  if (cancelErr && cancelErr.message.includes('BOOKING_NOT_FOUND')) {
    console.log('  [OK] RPC cancel_delivery_booking');
  } else {
    failures.push(`RPC cancel_delivery_booking missing or unexpected response: ${cancelErr?.message ?? 'no error'}`);
  }

  // Verify private parcel-proofs storage bucket
  const { data: bucket, error: bucketErr } = await supabase.storage.getBucket('parcel-proofs');
  if (bucketErr || !bucket) {
    failures.push(`Storage bucket 'parcel-proofs' missing: ${bucketErr?.message ?? 'not found'}`);
  } else if (bucket.public) {
    failures.push("Storage bucket 'parcel-proofs' must be private (public=false)");
  } else {
    console.log("  [OK] Storage bucket 'parcel-proofs' (private)");
  }

  if (failures.length > 0) {
    console.error('\nDatabase verification FAILED:');
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('\nAll 18 tables, role seeds, atomic RPCs, and private storage bucket verified successfully!');
}

verifySupabaseDatabase().catch((err) => {
  console.error('Verification error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
