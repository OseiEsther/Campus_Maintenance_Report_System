-- ============================================================================
-- CAMPUS MAINTENANCE REPORT SYSTEM (CampusFix) - SEED DATA SCRIPT
-- ============================================================================
-- Run this optional script in Supabase SQL Editor if you want to populate
-- initial demo profiles, campus locations, sample incident reports, and audit trails.
--
-- DEMO ACCOUNTS & LOGIN PASSWORDS:
-- +--------------------+-----------------------------------+---------+-------------+
-- | Name               | Email                             | Role    | Password    |
-- +--------------------+-----------------------------------+---------+-------------+
-- | Ama Mensah         | ama.mensah@st.university.edu.gh   | Student | password123 |
-- | Kwabena Owusu      | kwabena.owusu@st.university.edu.gh| Student | password123 |
-- | Akosua Frimpong    | akosua.frimpong@st.university.edu.gh| Student | password123 |
-- | Yaw Boateng        | yaw.boateng@st.university.edu.gh  | Student | password123 |
-- | Esi Ansah          | esi.ansah@st.university.edu.gh    | Rep     | password123 |
-- | Daniel Tetteh      | daniel.tetteh@st.university.edu.gh| Staff   | STAFF-5520  |
-- | Grace Adjei        | grace.adjei@st.university.edu.gh  | Admin   | password123 |
-- +--------------------+-----------------------------------+---------+-------------+
--
-- Note: You can also provision custom administrator accounts in your terminal:
--   npm run create-admin
-- ============================================================================

-- 1. DEMO PROFILES
insert into public.profiles (id, name, email, hall_or_dept, role, requires_password_change, temp_passkey, onboarded_at) values
  ('u1', 'Ama Mensah', 'ama.mensah@st.university.edu.gh', 'Pentagon Hall', 'student', false, 'password123', null),
  ('u2', 'Kwabena Owusu', 'kwabena.owusu@st.university.edu.gh', 'Republic Hall', 'student', false, 'password123', null),
  ('u3', 'Akosua Frimpong', 'akosua.frimpong@st.university.edu.gh', 'Independence Hall', 'student', false, 'password123', null),
  ('u4', 'Yaw Boateng', 'yaw.boateng@st.university.edu.gh', 'Continental Hall', 'student', false, 'password123', null),
  ('u5', 'Esi Ansah', 'esi.ansah@st.university.edu.gh', 'SRC Office', 'rep', false, 'password123', null),
  ('u6', 'Daniel Tetteh', 'daniel.tetteh@st.university.edu.gh', 'Maintenance Unit', 'staff', true, 'STAFF-5520', '2026-09-06T10:00:00Z'),
  ('u7', 'Grace Adjei', 'grace.adjei@st.university.edu.gh', 'Student Affairs', 'admin', false, 'password123', null)
on conflict (id) do update set temp_passkey = excluded.temp_passkey;

-- 2. CAMPUS LOCATIONS
insert into public.locations (id, name, building_type) values
  ('l1', 'Pentagon Hall, Room 204', 'residence'),
  ('l2', 'Pentagon Hall, Common Bathroom', 'residence'),
  ('l3', 'Republic Hall, Room 112', 'residence'),
  ('l4', 'Republic Hall, Block A Stairwell', 'residence'),
  ('l5', 'Independence Hall, Room 318', 'residence'),
  ('l6', 'Independence Hall, Kitchen Area', 'residence'),
  ('l7', 'Continental Hall, Room 405', 'residence'),
  ('l8', 'Continental Hall, Lobby', 'residence'),
  ('l9', 'Main Library, 2nd Floor Reading Room', 'library'),
  ('l10', 'Main Library, Ground Floor Restroom', 'library'),
  ('l11', 'Engineering Block, Lecture Hall 3', 'academic'),
  ('l12', 'Science Block, Lab 204', 'academic'),
  ('l13', 'Business School, Auditorium', 'academic'),
  ('l14', 'Administration Building, Office 12', 'administrative'),
  ('l15', 'Sports Complex, Changing Room', 'sports'),
  ('l16', 'Central Cafeteria, Dining Area', 'dining'),
  ('l17', 'Central Cafeteria, Kitchen', 'dining')
on conflict (id) do nothing;

-- 3. SAMPLE INCIDENT REPORTS
insert into public.reports (id, student_id, student_name, location_id, location_name, category, description, photo_url, status, verification_score, created_at) values
  ('r1', 'u1', 'Ama Mensah', 'l2', 'Pentagon Hall, Common Bathroom', 'plumbing', 'One of the shower heads in the common bathroom has been leaking continuously for three days. The floor is constantly wet and slippery, making it unsafe especially at night. Water is pooling near the drain and not draining properly.', 'https://images.pexels.com/photos/6899476/pexels-photo-6899476.jpeg?auto=compress&cs=tinysrgb&w=600', 'open', 7, '2026-09-04T14:30:00Z'),
  ('r2', 'u2', 'Kwabena Owusu', 'l4', 'Republic Hall, Block A Stairwell', 'electrical', 'The main light fixture on the third-floor landing of Block A stairwell is completely dead. The entire stairwell section is pitch black after 6 PM. Students are having to use phone flashlights which is dangerous when carrying heavy items or during late hours.', null, 'in_progress', 8, '2026-09-03T18:45:00Z'),
  ('r3', 'u3', 'Akosua Frimpong', 'l9', 'Main Library, 2nd Floor Reading Room', 'structural', 'A large section of the ceiling plaster near study carrels 14 to 18 has started cracking and small pieces have fallen onto the desks below. With midsem exams approaching, this area is heavily occupied and poses a direct safety hazard to studying students.', 'https://images.pexels.com/photos/5691527/pexels-photo-5691527.jpeg?auto=compress&cs=tinysrgb&w=600', 'open', 11, '2026-09-02T09:15:00Z'),
  ('r4', 'u4', 'Yaw Boateng', 'l16', 'Central Cafeteria, Dining Area', 'sanitation', 'Two large waste bins near the east exit of the cafeteria have not been emptied in over 48 hours. Rubbish is overflowing onto the tiled walkway, attracting stray animals and creating a very unpleasant smell that reaches the eating tables.', null, 'resolved', 6, '2026-08-30T12:00:00Z'),
  ('r5', 'u1', 'Ama Mensah', 'l11', 'Engineering Block, Lecture Hall 3', 'other', 'Multiple wooden desks in rows D and E have broken supports and splintered surfaces. During large lectures students cannot write comfortably and two students have snagged their clothing on exposed screws.', null, 'open', 4, '2026-09-05T08:00:00Z')
on conflict (id) do nothing;

-- 4. CORROBORATIONS
insert into public.corroborations (id, report_id, student_id, student_name, created_at) values
  ('c1', 'r1', 'u2', 'Kwabena Owusu', '2026-09-04T16:00:00Z'),
  ('c2', 'r2', 'u1', 'Ama Mensah', '2026-09-03T20:10:00Z'),
  ('c3', 'r2', 'u3', 'Akosua Frimpong', '2026-09-04T07:30:00Z'),
  ('c4', 'r3', 'u1', 'Ama Mensah', '2026-09-02T11:00:00Z'),
  ('c5', 'r3', 'u2', 'Kwabena Owusu', '2026-09-02T13:45:00Z'),
  ('c6', 'r3', 'u4', 'Yaw Boateng', '2026-09-02T15:20:00Z'),
  ('c7', 'r4', 'u3', 'Akosua Frimpong', '2026-08-30T14:15:00Z'),
  ('c8', 'r5', 'u2', 'Kwabena Owusu', '2026-09-05T10:00:00Z')
on conflict (id) do nothing;

-- 5. STATUS EVENTS (Audit Trail)
insert into public.status_events (id, report_id, status, note, actor_role, actor_name, actor_id, created_at) values
  ('se1', 'r1', 'open', 'Report submitted by Ama Mensah', 'student', 'Ama Mensah', 'u1', '2026-09-04T14:30:00Z'),
  ('se2', 'r2', 'open', 'Report submitted by Kwabena Owusu', 'student', 'Kwabena Owusu', 'u2', '2026-09-03T18:45:00Z'),
  ('se3', 'r2', 'in_progress', 'Work order WO-002 created. Facilities electrical team dispatched.', 'staff', 'Daniel Tetteh', 'u6', '2026-09-04T09:00:00Z'),
  ('se4', 'r3', 'open', 'Report submitted by Akosua Frimpong', 'student', 'Akosua Frimpong', 'u3', '2026-09-02T09:15:00Z'),
  ('se5', 'r3', 'open', 'Verified and confirmed on-site by Hall Rep Esi Ansah', 'rep', 'Esi Ansah', 'u5', '2026-09-02T12:00:00Z'),
  ('se6', 'r4', 'open', 'Report submitted by Yaw Boateng', 'student', 'Yaw Boateng', 'u4', '2026-08-30T12:00:00Z'),
  ('se7', 'r4', 'in_progress', 'Cleanliness team assigned. Bins scheduled for immediate clearing.', 'staff', 'Daniel Tetteh', 'u6', '2026-08-30T15:00:00Z'),
  ('se8', 'r4', 'resolved', 'All bins cleared, disinfected, and new liners installed. Area washed down.', 'staff', 'Daniel Tetteh', 'u6', '2026-08-31T08:30:00Z'),
  ('se9', 'r5', 'open', 'Report submitted by Ama Mensah', 'student', 'Ama Mensah', 'u1', '2026-09-05T08:00:00Z')
on conflict (id) do nothing;

-- 6. COMMENTS
insert into public.comments (id, report_id, author_id, author_name, author_role, text, created_at) values
  ('cm1', 'r1', 'u2', 'Kwabena Owusu', 'student', 'Can confirm, slipped here yesterday morning. Very risky.', '2026-09-04T16:05:00Z'),
  ('cm2', 'r2', 'u6', 'Daniel Tetteh', 'staff', 'Electrician team has this on schedule for replacement today.', '2026-09-04T09:15:00Z'),
  ('cm3', 'r3', 'u5', 'Esi Ansah', 'rep', 'Inspected this morning. Cordoned off desks 14-18 with tape.', '2026-09-02T12:05:00Z'),
  ('cm4', 'r3', 'u6', 'Daniel Tetteh', 'staff', 'Structural engineer visiting tomorrow 8 AM.', '2026-09-02T14:00:00Z')
on conflict (id) do nothing;

-- 7. INTERNAL NOTES
insert into public.internal_notes (id, report_id, author_id, author_name, author_role, text, created_at) values
  ('in1', 'r2', 'u6', 'Daniel Tetteh', 'staff', 'Requires 2x 36W fluorescent ballasts. Requisition submitted to Central Stores.', '2026-09-04T09:05:00Z'),
  ('in2', 'r3', 'u6', 'Daniel Tetteh', 'staff', 'Escalated to Institution Directorate. Plaster issue may be linked to roof membrane above 2nd floor.', '2026-09-02T14:05:00Z')
on conflict (id) do nothing;

-- 8. VERIFICATION SIGNALS
insert into public.verification_signals (id, report_id, label, points, created_at) values
  ('vs1', 'r1', '+1 report submitted', 1, '2026-09-04T14:30:00Z'),
  ('vs2', 'r1', '+3 detailed description (over 100 characters)', 3, '2026-09-04T14:30:00Z'),
  ('vs3', 'r1', '+2 photo attached', 2, '2026-09-04T14:30:00Z'),
  ('vs4', 'r1', '+2 corroborated by Kwabena Owusu', 2, '2026-09-04T16:00:00Z'),
  ('vs5', 'r2', '+1 report submitted', 1, '2026-09-03T18:45:00Z'),
  ('vs6', 'r2', '+3 detailed description (over 100 characters)', 3, '2026-09-03T18:45:00Z'),
  ('vs7', 'r2', '+2 corroborated by Ama Mensah', 2, '2026-09-03T20:10:00Z'),
  ('vs8', 'r2', '+2 corroborated by Akosua Frimpong', 2, '2026-09-04T07:30:00Z'),
  ('vs9', 'r3', '+1 report submitted', 1, '2026-09-02T09:15:00Z'),
  ('vs10', 'r3', '+3 detailed description (over 100 characters)', 3, '2026-09-02T09:15:00Z'),
  ('vs11', 'r3', '+2 photo attached', 2, '2026-09-02T09:15:00Z'),
  ('vs12', 'r3', 'Verified by Rep', 10, '2026-09-02T12:00:00Z'),
  ('vs13', 'r4', '+1 report submitted', 1, '2026-08-30T12:00:00Z'),
  ('vs14', 'r4', '+3 detailed description (over 100 characters)', 3, '2026-08-30T12:00:00Z'),
  ('vs15', 'r4', '+2 corroborated by Akosua Frimpong', 2, '2026-08-30T14:15:00Z'),
  ('vs16', 'r5', '+1 report submitted', 1, '2026-09-05T08:00:00Z'),
  ('vs17', 'r5', '+3 detailed description (over 100 characters)', 3, '2026-09-05T08:00:00Z')
on conflict (id) do nothing;

-- 9. NOTIFICATIONS
insert into public.notifications (id, user_id, type, report_id, report_description, message, read, created_at) values
  ('n1', 'u1', 'corroboration', 'r1', 'Pentagon Hall, Common Bathroom: Leaking shower head', 'Kwabena Owusu corroborated your report', false, '2026-09-04T16:00:00Z'),
  ('n2', 'u2', 'status_change', 'r2', 'Republic Hall, Block A Stairwell: Broken lighting', 'Your report status changed to In Progress: Work order WO-002 created', false, '2026-09-04T09:00:00Z'),
  ('n3', 'u3', 'rep_action', 'r3', 'Main Library, 2nd Floor Reading Room: Ceiling damage', 'Hall Rep Esi Ansah verified and confirmed your report', false, '2026-09-02T12:00:00Z'),
  ('n4', 'u4', 'status_change', 'r4', 'Central Cafeteria, Dining Area: Overflowing bins', 'Your report was marked Resolved: Bins cleared and sanitized', true, '2026-08-31T08:30:00Z')
on conflict (id) do nothing;
