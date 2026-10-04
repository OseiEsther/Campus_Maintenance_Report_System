-- ============================================================================
-- CAMPUS MAINTENANCE REPORT SYSTEM (CampusFix) - MASTER SUPABASE SCHEMA
-- ============================================================================
-- ONE-STOP SETUP: This single script completely configures your Supabase project.
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
--
-- Safe to run on a BRAND NEW project or an EXISTING project.
-- Includes:
--   1. All database tables and primary/foreign keys
--   2. Safe column updates (ensures no missing columns on older tables)
--   3. Performance indexes
--   4. Row Level Security (RLS) permissive policies
--   5. Storage bucket ('report-photos') configuration and policies
--   6. Realtime publication subscriptions for all tables
--   7. Schema cache reload for PostgREST
-- ============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. PROFILES TABLE (Users & Auth)
create table if not exists public.profiles (
  id text primary key,
  name text not null,
  email text unique not null,
  hall_or_dept text not null,
  role text not null check (role in ('student', 'rep', 'staff', 'admin')),
  requires_password_change boolean default false,
  temp_passkey text,
  is_banned boolean not null default false,
  ban_reason text,
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

-- Ensure all profiles columns exist if table was previously created
alter table public.profiles add column if not exists temp_passkey text;
alter table public.profiles add column if not exists requires_password_change boolean default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists onboarded_at timestamptz;

-- 3. LOCATIONS TABLE (Campus Buildings & Rooms)
create table if not exists public.locations (
  id text primary key,
  name text not null,
  building_type text not null check (building_type in ('residence', 'academic', 'administrative', 'library', 'sports', 'dining')),
  created_at timestamptz default now()
);

-- 4. REPORTS TABLE (Incidents)
create table if not exists public.reports (
  id text primary key,
  student_id text not null references public.profiles(id) on delete cascade,
  student_name text not null,
  location_id text not null references public.locations(id) on delete cascade,
  location_name text not null,
  category text not null check (category in ('electrical', 'plumbing', 'structural', 'sanitation', 'other')),
  description text not null,
  photo_url text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  verification_score integer not null default 1,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_reason text,
  created_at timestamptz default now()
);

-- Ensure all reports columns exist if table was previously created
alter table public.reports add column if not exists is_archived boolean not null default false;
alter table public.reports add column if not exists archived_at timestamptz;
alter table public.reports add column if not exists archived_reason text;

-- 5. CORROBORATIONS TABLE ("I've seen this too")
create table if not exists public.corroborations (
  id text primary key,
  report_id text not null references public.reports(id) on delete cascade,
  student_id text not null references public.profiles(id) on delete cascade,
  student_name text not null,
  created_at timestamptz default now(),
  constraint unique_report_student_corroboration unique (report_id, student_id)
);

-- 6. STATUS EVENTS TABLE (Audit Trail & Timeline)
create table if not exists public.status_events (
  id text primary key,
  report_id text not null,
  status text not null check (status in ('open', 'in_progress', 'resolved')),
  note text not null,
  actor_role text not null check (actor_role in ('student', 'rep', 'staff', 'admin')),
  actor_name text,
  actor_id text,
  created_at timestamptz default now()
);

-- 7. COMMENTS TABLE (Public ticket conversation)
create table if not exists public.comments (
  id text primary key,
  report_id text not null references public.reports(id) on delete cascade,
  author_id text not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('student', 'rep', 'staff', 'admin')),
  text text not null,
  created_at timestamptz default now()
);

-- 8. INTERNAL NOTES TABLE (Staff operational notes)
create table if not exists public.internal_notes (
  id text primary key,
  report_id text not null references public.reports(id) on delete cascade,
  author_id text not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('student', 'rep', 'staff', 'admin')),
  text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- 9. VERIFICATION SIGNALS TABLE (Score breakdown)
create table if not exists public.verification_signals (
  id text primary key,
  report_id text not null references public.reports(id) on delete cascade,
  label text not null,
  points integer not null default 1,
  created_at timestamptz default now()
);

-- 10. NOTIFICATIONS TABLE
create table if not exists public.notifications (
  id text primary key,
  user_id text references public.profiles(id) on delete cascade,
  type text not null check (type in ('corroboration', 'status_change', 'rep_action', 'comment', 'rep_request', 'admin_notice')),
  report_id text not null,
  report_description text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- 11. HALL REP REQUESTS TABLE (Student appointment applications)
create table if not exists public.hall_rep_requests (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  user_name text not null,
  user_email text not null,
  hall text not null,
  statement text not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'stepped_down')) default 'pending',
  rejection_reason text,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

-- Ensure all hall_rep_requests columns and constraints exist if table was previously created
alter table public.hall_rep_requests add column if not exists rejection_reason text;
alter table public.hall_rep_requests add column if not exists reviewed_at timestamptz;
alter table public.hall_rep_requests add column if not exists reviewed_by text;
alter table public.hall_rep_requests drop constraint if exists hall_rep_requests_status_check;
alter table public.hall_rep_requests add constraint hall_rep_requests_status_check check (status in ('pending', 'approved', 'rejected', 'stepped_down'));

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
create index if not exists idx_reports_student on public.reports(student_id);
create index if not exists idx_reports_location on public.reports(location_id);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_created on public.reports(created_at desc);
create index if not exists idx_reports_archived on public.reports(is_archived);
create index if not exists idx_corroborations_report on public.corroborations(report_id);
create index if not exists idx_status_events_report on public.status_events(report_id);
create index if not exists idx_comments_report on public.comments(report_id);
create index if not exists idx_internal_notes_report on public.internal_notes(report_id);
create index if not exists idx_verification_signals_report on public.verification_signals(report_id);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_hall_rep_requests_user on public.hall_rep_requests(user_id);
create index if not exists idx_hall_rep_requests_status on public.hall_rep_requests(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Permissive policies allowing the application to read and write
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.reports enable row level security;
alter table public.corroborations enable row level security;
alter table public.status_events enable row level security;
alter table public.comments enable row level security;
alter table public.internal_notes enable row level security;
alter table public.verification_signals enable row level security;
alter table public.notifications enable row level security;
alter table public.hall_rep_requests enable row level security;

-- Profiles Policies
drop policy if exists "Allow select profiles" on public.profiles;
create policy "Allow select profiles" on public.profiles for select using (true);

drop policy if exists "Allow insert profiles" on public.profiles;
create policy "Allow insert profiles" on public.profiles for insert with check (true);

drop policy if exists "Allow update profiles" on public.profiles;
create policy "Allow update profiles" on public.profiles for update using (true);

drop policy if exists "Allow delete profiles" on public.profiles;
create policy "Allow delete profiles" on public.profiles for delete using (true);

-- Locations Policies
drop policy if exists "Allow select locations" on public.locations;
create policy "Allow select locations" on public.locations for select using (true);

drop policy if exists "Allow insert locations" on public.locations;
create policy "Allow insert locations" on public.locations for insert with check (true);

drop policy if exists "Allow update locations" on public.locations;
create policy "Allow update locations" on public.locations for update using (true);

drop policy if exists "Allow delete locations" on public.locations;
create policy "Allow delete locations" on public.locations for delete using (true);

-- Reports Policies
drop policy if exists "Allow select reports" on public.reports;
create policy "Allow select reports" on public.reports for select using (true);

drop policy if exists "Allow insert reports" on public.reports;
create policy "Allow insert reports" on public.reports for insert with check (true);

drop policy if exists "Allow update reports" on public.reports;
create policy "Allow update reports" on public.reports for update using (true);

drop policy if exists "Allow delete reports" on public.reports;
create policy "Allow delete reports" on public.reports for delete using (true);

-- Corroborations Policies
drop policy if exists "Allow select corroborations" on public.corroborations;
create policy "Allow select corroborations" on public.corroborations for select using (true);

drop policy if exists "Allow insert corroborations" on public.corroborations;
create policy "Allow insert corroborations" on public.corroborations for insert with check (true);

-- Status Events Policies
drop policy if exists "Allow select status_events" on public.status_events;
create policy "Allow select status_events" on public.status_events for select using (true);

drop policy if exists "Allow insert status_events" on public.status_events;
create policy "Allow insert status_events" on public.status_events for insert with check (true);

-- Comments Policies
drop policy if exists "Allow select comments" on public.comments;
create policy "Allow select comments" on public.comments for select using (true);

drop policy if exists "Allow insert comments" on public.comments;
create policy "Allow insert comments" on public.comments for insert with check (true);

-- Internal Notes Policies
drop policy if exists "Allow select internal_notes" on public.internal_notes;
create policy "Allow select internal_notes" on public.internal_notes for select using (true);

drop policy if exists "Allow insert internal_notes" on public.internal_notes;
create policy "Allow insert internal_notes" on public.internal_notes for insert with check (true);

drop policy if exists "Allow update internal_notes" on public.internal_notes;
create policy "Allow update internal_notes" on public.internal_notes for update using (true);

drop policy if exists "Allow delete internal_notes" on public.internal_notes;
create policy "Allow delete internal_notes" on public.internal_notes for delete using (true);

-- Verification Signals Policies
drop policy if exists "Allow select verification_signals" on public.verification_signals;
create policy "Allow select verification_signals" on public.verification_signals for select using (true);

drop policy if exists "Allow insert verification_signals" on public.verification_signals;
create policy "Allow insert verification_signals" on public.verification_signals for insert with check (true);

-- Notifications Policies
drop policy if exists "Allow select notifications" on public.notifications;
create policy "Allow select notifications" on public.notifications for select using (true);

drop policy if exists "Allow insert notifications" on public.notifications;
create policy "Allow insert notifications" on public.notifications for insert with check (true);

drop policy if exists "Allow update notifications" on public.notifications;
create policy "Allow update notifications" on public.notifications for update using (true);

drop policy if exists "Allow delete notifications" on public.notifications;
create policy "Allow delete notifications" on public.notifications for delete using (true);

-- Hall Rep Requests Policies
drop policy if exists "Allow select hall_rep_requests" on public.hall_rep_requests;
create policy "Allow select hall_rep_requests" on public.hall_rep_requests for select using (true);

drop policy if exists "Allow insert hall_rep_requests" on public.hall_rep_requests;
create policy "Allow insert hall_rep_requests" on public.hall_rep_requests for insert with check (true);

drop policy if exists "Allow update hall_rep_requests" on public.hall_rep_requests;
create policy "Allow update hall_rep_requests" on public.hall_rep_requests for update using (true);

drop policy if exists "Allow delete hall_rep_requests" on public.hall_rep_requests;
create policy "Allow delete hall_rep_requests" on public.hall_rep_requests for delete using (true);

-- ============================================================================
-- STORAGE BUCKET CONFIGURATION (report-photos)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-photos',
  'report-photos',
  true,
  10485760, -- 10 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

drop policy if exists "Public Access to Report Photos" on storage.objects;
create policy "Public Access to Report Photos" on storage.objects
  for select using (bucket_id = 'report-photos');

drop policy if exists "Allow Uploads to Report Photos" on storage.objects;
create policy "Allow Uploads to Report Photos" on storage.objects
  for insert with check (bucket_id = 'report-photos');

drop policy if exists "Allow Updates to Report Photos" on storage.objects;
create policy "Allow Updates to Report Photos" on storage.objects
  for update using (bucket_id = 'report-photos');

drop policy if exists "Allow Deletions to Report Photos" on storage.objects;
create policy "Allow Deletions to Report Photos" on storage.objects
  for delete using (bucket_id = 'report-photos');

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table
    public.reports,
    public.corroborations,
    public.status_events,
    public.comments,
    public.internal_notes,
    public.verification_signals,
    public.notifications,
    public.locations,
    public.profiles,
    public.hall_rep_requests;
exception
  when others then
    null;
end $$;

-- ============================================================================
-- RELOAD POSTGREST SCHEMA CACHE
-- ============================================================================
notify pgrst, 'reload schema';
