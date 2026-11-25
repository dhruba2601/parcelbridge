import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

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
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || url.includes('your-project-ref')) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env to verify live Supabase.');
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
      failures.push(`${table}: ${error.message}`);
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

  if (failures.length > 0) {
    console.error('\nDatabase verification FAILED:');
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('\nAll 18 tables and role seeds verified successfully!');
}

verifySupabaseDatabase().catch((err) => {
  console.error('Verification error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
