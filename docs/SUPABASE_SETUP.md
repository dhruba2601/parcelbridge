# Supabase PostgreSQL Setup Guide

1. **Create a Supabase Project** at [supabase.com](https://supabase.com).
2. **Execute Migrations in Order** in the Supabase SQL Editor (or run `database/schema.sql` once):
   - `database/migrations/202611250001_initial_schema.sql` (18 normalized tables, constraints, indexes)
   - `database/migrations/202611250002_rls_policies.sql` (Row Level Security policies)
   - `database/migrations/202611250003_atomic_scheduling_and_triggers.sql` (`reserve_delivery_slot` RPC + triggers)
   - `database/migrations/202611250004_cancel_booking_and_storage.sql` (`cancel_delivery_booking` RPC + `parcel-proofs` storage bucket & policies)
3. **Optional Demo Seed (Development/Staging Only)**:
   - Run `database/seed.sql`. All demo records are flagged with `is_demo = TRUE`.
4. **Verify Database Schema**:
   - Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` and run:
     ```bash
     cd backend && npm run db:verify
     ```
5. **Backups & Recovery**:
   - Enable Point-in-Time Recovery (PITR) or daily automated backups in Supabase Dashboard → Database → Backups.
   - To recover from accidental data loss, restore to a timestamp prior to the incident in Supabase Dashboard → Backups, then verify with `npm run db:verify`.
