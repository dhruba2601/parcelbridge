import { repo } from '../db/repository';
import { logger } from '../utils/logger';

async function main() {
  logger.info('Demo seed verification', {
    societies: repo.memory.societies.length,
    hubs: repo.memory.hubs.length,
    demoProfiles: repo.memory.profiles.length,
    demoParcels: repo.memory.parcels.length,
    note: 'For Supabase PostgreSQL, run supabase/migrations/*.sql and supabase/seed/seed_demo.sql in your Supabase SQL Editor.',
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
