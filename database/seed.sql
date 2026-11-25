-- PARCELBRIDGE: Demonstration Seed Data (clearly marked is_demo = TRUE)
-- Run ONLY in development/demo environments. Never mix demo records with production customer records.

-- 1. Demo Societies
INSERT INTO public.societies (id, name, code, address_line1, city, state, postal_code, timezone, total_units, is_demo)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'Skyline Residency', 'SKY-BLR-01', 'Outer Ring Road, Bellandur', 'Bengaluru', 'Karnataka', '560103', 'Asia/Kolkata', 420, TRUE),
  ('11111111-1111-4111-8111-111111111102', 'Emerald Greens Cooperative', 'EMG-MUM-02', 'Powai Lake Road', 'Mumbai', 'Maharashtra', '400076', 'Asia/Kolkata', 280, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. Demo Residential Units
INSERT INTO public.residential_units (id, society_id, tower_block, unit_number, floor_number, is_demo)
VALUES
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'Tower A', 'A-402', 4, TRUE),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111101', 'Tower B', 'B-905', 9, TRUE),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111102', 'Maple', 'M-1201', 12, TRUE)
ON CONFLICT DO NOTHING;

-- 3. Demo Parcel Hubs
INSERT INTO public.parcel_hubs (id, society_id, name, code, location_description, capacity, current_occupancy, operating_hours, is_demo)
VALUES
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111101', 'Skyline Gate-1 Smart Hub', 'HUB-SKY-01', 'Basement Level 1, Near Tower A Lift Lobby', 600, 3, '07:00 - 22:00', TRUE),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111102', 'Emerald Central Parcel Room', 'HUB-EMG-01', 'Clubhouse Ground Floor Annex', 400, 1, '07:30 - 21:30', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 4. Proposed Future Courier Partners (labelled as planned, not live)
INSERT INTO public.courier_partners (id, name, code, integration_status, is_demo)
VALUES
  ('44444444-4444-4444-8444-444444444401', 'BlueDart Express (Proposed)', 'BLUEDART', 'planned', TRUE),
  ('44444444-4444-4444-8444-444444444402', 'Delhivery Logistics (Proposed)', 'DELHIVERY', 'planned', TRUE),
  ('44444444-4444-4444-8444-444444444403', 'XpressBees (Proposed)', 'XPRESSBEES', 'planned', TRUE)
ON CONFLICT (code) DO NOTHING;
