-- ============================================================================
-- CAMPUS MAINTENANCE REPORT SYSTEM (CampusFix) - SEED DATA SCRIPT
-- ============================================================================
-- Optional demonstration records for campus locations, sample incident reports,
-- and public facilities.
--
-- Notice: In production and testing with Supabase Auth, accounts are created
-- via the sign-up portal or the local administrator provisioning script:
--   node scripts/create-admin.mjs
-- ============================================================================

-- 1. CAMPUS LOCATIONS
insert into public.locations (id, name, building_type, hall) values
  ('00000000-0000-0000-0000-000000000001', 'Pentagon Hall, Room 204', 'residence', 'Pentagon Hall'),
  ('00000000-0000-0000-0000-000000000002', 'Pentagon Hall, Common Bathroom', 'residence', 'Pentagon Hall'),
  ('00000000-0000-0000-0000-000000000003', 'Republic Hall, Room 112', 'residence', 'Republic Hall'),
  ('00000000-0000-0000-0000-000000000004', 'Republic Hall, Block A Stairwell', 'residence', 'Republic Hall'),
  ('00000000-0000-0000-0000-000000000005', 'Independence Hall, Room 318', 'residence', 'Independence Hall'),
  ('00000000-0000-0000-0000-000000000006', 'Independence Hall, Kitchen Area', 'residence', 'Independence Hall'),
  ('00000000-0000-0000-0000-000000000007', 'Continental Hall, Room 405', 'residence', 'Continental Hall'),
  ('00000000-0000-0000-0000-000000000008', 'Continental Hall, Lobby', 'residence', 'Continental Hall'),
  ('00000000-0000-0000-0000-000000000009', 'Main Library, 2nd Floor Reading Room', 'library', 'Main Library'),
  ('00000000-0000-0000-0000-000000000010', 'Main Library, Ground Floor Restroom', 'library', 'Main Library'),
  ('00000000-0000-0000-0000-000000000011', 'Engineering Block, Lecture Hall 3', 'academic', 'Engineering Block'),
  ('00000000-0000-0000-0000-000000000012', 'Science Block, Lab 204', 'academic', 'Science Block'),
  ('00000000-0000-0000-0000-000000000013', 'Business School, Auditorium', 'academic', 'Business School'),
  ('00000000-0000-0000-0000-000000000014', 'Administration Building, Office 12', 'administrative', 'Administration Building'),
  ('00000000-0000-0000-0000-000000000015', 'Sports Complex, Changing Room', 'sports', 'Sports Complex'),
  ('00000000-0000-0000-0000-000000000016', 'Central Cafeteria, Dining Area', 'dining', 'Central Cafeteria'),
  ('00000000-0000-0000-0000-000000000017', 'Central Cafeteria, Kitchen', 'dining', 'Central Cafeteria')
on conflict (id) do nothing;
