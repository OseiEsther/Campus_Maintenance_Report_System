-- ============================================================================
-- CAMPUS MAINTENANCE REPORT SYSTEM (CampusFix) - PRODUCTION SUPABASE SCHEMA
-- ============================================================================
-- Architecture:
--   - PostgreSQL with Row Level Security (RLS)
--   - Supabase Auth integration (profiles linked to auth.users)
--   - Database-enforced verification scoring (+1 submit, +3 desc, +2 photo, +2 corrob, +10 rep, -5 dispute)
--   - Append-only immutable audit trail (status_events)
--   - Staff operations with priority triage and technician assignment
--   - Storage bucket security with user folder scoping
-- ============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. PROFILES TABLE (Linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  hall_or_dept text not null default 'Campus General',
  role text not null default 'student' check (role in ('student', 'rep', 'staff', 'admin')),
  requires_password_change boolean not null default false,
  is_banned boolean not null default false,
  ban_reason text,
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

-- Ensure legacy columns are dropped and required columns exist if upgrading
alter table public.profiles drop column if exists temp_passkey;
alter table public.profiles add column if not exists requires_password_change boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists onboarded_at timestamptz;

-- 3. LOCATIONS TABLE (Campus Buildings & Facilities)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  building_type text not null check (building_type in ('residence', 'academic', 'administrative', 'library', 'sports', 'dining')),
  hall text,
  created_at timestamptz default now()
);

alter table public.locations add column if not exists hall text;

-- 4. REPORTS TABLE (Maintenance Incidents & Work Orders)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_name text not null,
  location_id uuid not null references public.locations(id) on delete cascade,
  location_name text not null,
  hall text,
  category text not null check (category in ('electrical', 'plumbing', 'structural', 'sanitation', 'other')),
  description text not null check (length(description) >= 20 and length(description) <= 500),
  photo_url text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to text,
  verification_score integer not null default 1 check (verification_score between 0 and 20),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_reason text,
  created_at timestamptz default now()
);

-- Ensure columns exist if upgrading an existing reports table
alter table public.reports add column if not exists hall text;
alter table public.reports add column if not exists priority text not null default 'medium';
alter table public.reports add column if not exists assigned_to text;
alter table public.reports add column if not exists verification_score integer not null default 1;
alter table public.reports add column if not exists is_archived boolean not null default false;
alter table public.reports add column if not exists archived_at timestamptz;
alter table public.reports add column if not exists archived_reason text;

-- 5. CORROBORATIONS TABLE ("I've seen this too")
create table if not exists public.corroborations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_name text not null,
  created_at timestamptz default now(),
  constraint unique_report_student_corroboration unique (report_id, student_id)
);

-- 6. STATUS EVENTS TABLE (Immutable Audit Trail)
create table if not exists public.status_events (
  id uuid primary key default gen_random_uuid(),
  report_id text not null,
  status text not null check (status in ('open', 'in_progress', 'resolved')),
  note text not null,
  actor_role text not null check (actor_role in ('student', 'rep', 'staff', 'admin')),
  actor_name text,
  actor_id text,
  created_at timestamptz default now()
);

alter table public.status_events add column if not exists actor_name text;
alter table public.status_events add column if not exists actor_id text;

-- 7. COMMENTS TABLE (Public ticket context)
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('student', 'rep', 'staff', 'admin')),
  text text not null check (length(text) >= 1 and length(text) <= 1000),
  created_at timestamptz default now()
);

-- 8. INTERNAL NOTES TABLE (Restricted to Maintenance Staff & Admins)
create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('staff', 'admin')),
  text text not null check (length(text) >= 1 and length(text) <= 2000),
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- 9. VERIFICATION SIGNALS TABLE
create table if not exists public.verification_signals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  label text not null,
  points integer not null,
  created_at timestamptz default now()
);

-- 10. NOTIFICATIONS TABLE
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('corroboration', 'status_change', 'rep_action', 'comment', 'rep_request', 'admin_notice')),
  report_id text not null,
  report_description text not null,
  message text not null,
  created_at timestamptz default now(),
  read boolean not null default false
);

-- 11. HALL REP REQUESTS TABLE
create table if not exists public.hall_rep_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  user_email text not null,
  hall text not null,
  statement text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'stepped_down')),
  rejection_reason text,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

-- ============================================================================
-- INDEXES FOR QUERY OPTIMIZATION
-- ============================================================================
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_reports_location on public.reports(location_id);
create index if not exists idx_reports_student on public.reports(student_id);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_priority on public.reports(priority);
create index if not exists idx_reports_created on public.reports(created_at desc);
create index if not exists idx_corroborations_report on public.corroborations(report_id);
create index if not exists idx_comments_report on public.comments(report_id);
create index if not exists idx_status_events_report on public.status_events(report_id);
create index if not exists idx_internal_notes_report on public.internal_notes(report_id);
create index if not exists idx_notifications_user on public.notifications(user_id, read);
create index if not exists idx_hall_rep_requests_user on public.hall_rep_requests(user_id);

-- ============================================================================
-- SECURITY HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_banned = false
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin') and is_banned = false
  );
$$;

create or replace function public.is_rep()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('rep', 'admin') and is_banned = false
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_banned = false
  );
$$;

-- ============================================================================
-- INSTITUTIONAL EMAIL DOMAIN CONFIGURATION
-- ============================================================================
create table if not exists public.allowed_email_domains (
  domain text primary key,
  description text
);

-- Seed authorized student email domain
insert into public.allowed_email_domains (domain, description)
values
  ('@st.university.edu.gh', 'Official university student email domain')
on conflict (domain) do nothing;

-- ============================================================================
-- CAMPUS UNITS REGISTRY (Halls, Departments, Administrative Units)
-- ============================================================================
create table if not exists public.campus_units (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  category text not null check (category in ('hall', 'department', 'administrative')),
  created_at timestamptz default now()
);

create index if not exists idx_campus_units_category on public.campus_units(category);
create index if not exists idx_campus_units_name on public.campus_units(name);

-- Seed official campus units (Residence Halls, Academic Departments, Administrative Units)
insert into public.campus_units (name, category)
values
  -- Residence Halls
  ('Pentagon Hall', 'hall'),
  ('Republic Hall', 'hall'),
  ('Independence Hall', 'hall'),
  ('Continental Hall', 'hall'),
  ('Commonwealth Hall', 'hall'),
  ('Legon Hall', 'hall'),
  ('Jean Nelson Aka Hall', 'hall'),
  ('Alexander Kwapong Hall', 'hall'),
  ('Jubilee Hall', 'hall'),
  ('Elizabeth Frances Sey Hall', 'hall'),

  -- Academic Departments
  ('Computer Science & IT', 'department'),
  ('Electrical & Electronic Engineering', 'department'),
  ('Mechanical & Civil Engineering', 'department'),
  ('Business Administration & Accounting', 'department'),
  ('Faculty of Law', 'department'),
  ('School of Medicine & Health Sciences', 'department'),
  ('Biological & Physical Sciences', 'department'),
  ('Humanities & Social Sciences', 'department'),

  -- Administrative & General Units
  ('Student Affairs & SRC', 'administrative'),
  ('Physical Development & Municipal Services', 'administrative'),
  ('Academic Affairs', 'administrative'),
  ('Library & Archives', 'administrative'),
  ('Central Administration', 'administrative')
on conflict (name) do nothing;

-- Ensure locations registry is synchronized with official campus units
insert into public.locations (id, name, building_type, hall)
select
  u.id,
  u.name,
  case
    when u.category = 'hall' then 'residence'
    when u.category = 'department' then 'academic'
    else 'administrative'
  end,
  u.name
from public.campus_units u
on conflict (id) do nothing;

-- ============================================================================
-- AUTOMATED AUTH TRIGGER (Profiles & Email Sandboxing)
-- ============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_hall text;
  v_role text;
  v_requires_pw boolean;
begin
  -- Security: Read role STRICTLY from raw_app_meta_data (server/admin controlled).
  -- Any client-supplied raw_user_meta_data role is ignored. Default is always student.
  v_role := coalesce(new.raw_app_meta_data->>'role', 'student');
  if v_role not in ('student', 'rep', 'staff', 'admin') then
    v_role := 'student';
  end if;

  -- Validate institutional email ending against allowed settings ONLY for student accounts.
  -- Staff and admin accounts are provisioned exclusively by server/admin callers via raw_app_meta_data.
  if v_role = 'student' then
    if not exists (
      select 1 from public.allowed_email_domains
      where domain = '%'
         or lower(new.email) like ('%' || lower(domain))
    ) then
      raise exception 'Registration rejected: Email must belong to an authorized institutional domain';
    end if;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_hall := coalesce(new.raw_user_meta_data->>'hall_or_dept', new.raw_user_meta_data->>'hall', 'Campus General');

  v_requires_pw := coalesce(
    (new.raw_app_meta_data->>'requires_password_change')::boolean,
    (new.raw_user_meta_data->>'requires_password_change')::boolean,
    false
  );

  insert into public.profiles (
    id,
    name,
    email,
    hall_or_dept,
    role,
    requires_password_change,
    is_banned,
    created_at
  )
  values (
    new.id,
    v_name,
    new.email,
    v_hall,
    v_role,
    v_requires_pw,
    false,
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name);

  return new;
end;
$$;

drop trigger if exists tr_on_auth_user_created on auth.users;
create trigger tr_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- Trigger to guard profiles role and status changes
create or replace function public.guard_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    if new.role is distinct from old.role then
      raise exception 'Only administrators can modify user roles';
    end if;
    if new.is_banned is distinct from old.is_banned or new.ban_reason is distinct from old.ban_reason then
      raise exception 'Only administrators can suspend or reinstate accounts';
    end if;
    if new.requires_password_change is distinct from old.requires_password_change and new.id != auth.uid() then
      raise exception 'Unauthorized password flag update';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_guard_profile_updates on public.profiles;
create trigger tr_guard_profile_updates
  before update on public.profiles
  for each row
  execute function public.guard_profile_updates();

-- ============================================================================
-- VERIFICATION SCORING ENGINE (DATABASE TRIGGERS & FUNCTIONS)
-- ============================================================================

-- Compute initial verification score BEFORE report insert
create or replace function public.calc_initial_report_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score integer := 1;
begin
  -- +3 Detailed description point (>= 100 characters)
  if length(new.description) >= 100 then
    v_score := v_score + 3;
  end if;

  -- +2 Photo attached point
  if new.photo_url is not null and length(trim(new.photo_url)) > 0 then
    v_score := v_score + 2;
  end if;

  new.verification_score := least(20, greatest(0, v_score));
  return new;
end;
$$;

drop trigger if exists tr_calc_initial_report_score on public.reports;
create trigger tr_calc_initial_report_score
  before insert on public.reports
  for each row
  execute function public.calc_initial_report_score();

-- Insert verification signals AFTER report row is saved
create or replace function public.on_report_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- +1 Base submission point
  insert into public.verification_signals (report_id, label, points)
  values (new.id, '+1 report submitted', 1);

  -- +3 Detailed description point (>= 100 characters)
  if length(new.description) >= 100 then
    insert into public.verification_signals (report_id, label, points)
    values (new.id, '+3 detailed description (over 100 characters)', 3);
  end if;

  -- +2 Photo attached point
  if new.photo_url is not null and length(trim(new.photo_url)) > 0 then
    insert into public.verification_signals (report_id, label, points)
    values (new.id, '+2 photo attached', 2);
  end if;

  return new;
end;
$$;

drop trigger if exists tr_on_report_inserted on public.reports;
create trigger tr_on_report_inserted
  after insert on public.reports
  for each row
  execute function public.on_report_inserted();

-- Trigger on Corroborations (+2 points)
create or replace function public.on_corroboration_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
  v_new_score integer;
begin
  select * into v_report from public.reports where id = new.report_id;
  if not found then
    return new;
  end if;

  -- Refuse corroboration on resolved or archived incident reports
  if v_report.status = 'resolved' or v_report.is_archived then
    raise exception 'Corroboration is not permitted on resolved or archived incident reports';
  end if;

  -- Author cannot corroborate own report
  if v_report.student_id = new.student_id then
    raise exception 'Students cannot corroborate their own incident report';
  end if;

  -- Set trusted context session variable for score update
  perform set_config('campusfix.trusted_context', 'true', true);

  v_new_score := least(20, v_report.verification_score + 2);

  update public.reports
  set verification_score = v_new_score
  where id = new.report_id;

  insert into public.verification_signals (report_id, label, points)
  values (new.report_id, '+2 corroborated by ' || new.student_name, 2);

  -- Notify report owner
  insert into public.notifications (user_id, type, report_id, report_description, message)
  values (
    v_report.student_id,
    'corroboration',
    new.report_id::text,
    v_report.location_name || ': ' || left(v_report.description, 45) || '...',
    new.student_name || ' corroborated your report'
  );

  return new;
end;
$$;

drop trigger if exists tr_on_corroboration_inserted on public.corroborations;
create trigger tr_on_corroboration_inserted
  after insert on public.corroborations
  for each row
  execute function public.on_corroboration_inserted();

-- Guard reports from direct score tampering by browser clients
create or replace function public.guard_report_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.verification_score is distinct from old.verification_score then
    -- Allow update if called through authorized database functions or triggers
    if coalesce(nullif(current_setting('campusfix.trusted_context', true), ''), '') <> 'true' and not public.is_admin() then
      -- If score changed outside of trusted RPC or trigger, reject
      raise exception 'Direct modification of verification_score is prohibited';
    end if;
  end if;

  if not public.is_staff() then
    if new.status is distinct from old.status then
      raise exception 'Only maintenance staff can modify report status';
    end if;
    if new.priority is distinct from old.priority then
      raise exception 'Only maintenance staff can modify report priority';
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      raise exception 'Only maintenance staff can assign technicians';
    end if;
  end if;

  if not public.is_admin() then
    if new.is_archived is distinct from old.is_archived or new.archived_reason is distinct from old.archived_reason then
      raise exception 'Only administrators can archive reports';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_guard_report_updates on public.reports;
create trigger tr_guard_report_updates
  before update on public.reports
  for each row
  execute function public.guard_report_updates();

-- ============================================================================
-- TRUSTED HALL REP ACTIONS (+10 Confirm, -5 Dispute)
-- ============================================================================
create or replace function public.rep_confirm_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.profiles%rowtype;
  v_report public.reports%rowtype;
  v_new_score integer;
  v_already_confirmed boolean;
begin
  select * into v_user from public.profiles where id = auth.uid();
  if not found or v_user.role not in ('rep', 'admin') or v_user.is_banned then
    raise exception 'Unauthorized: Caller is not an active Hall Representative';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  -- Hall restriction: Representative must represent the hall of the report (admins exempted)
  if v_user.role <> 'admin' then
    if v_report.hall is null or lower(trim(v_user.hall_or_dept)) <> lower(trim(v_report.hall)) then
      raise exception 'Unauthorized: Representative may only act on reports from their assigned hall';
    end if;
  end if;

  -- Check if already confirmed or disputed by this rep
  select exists (
    select 1 from public.status_events
    where report_id = p_report_id::text
      and actor_id = v_user.id::text
      and (note ilike '%Verified and confirmed by Hall Rep%' or note ilike '%Disputed by Hall Rep%')
  ) into v_already_confirmed;

  if v_already_confirmed then
    raise exception 'Representative has already taken action on this report';
  end if;

  -- Set trusted context session variable for score update
  perform set_config('campusfix.trusted_context', 'true', true);

  v_new_score := least(20, v_report.verification_score + 10);

  update public.reports
  set verification_score = v_new_score
  where id = p_report_id;

  insert into public.verification_signals (report_id, label, points)
  values (p_report_id, '+10 rep-confirmed by ' || v_user.name, 10);

  insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
  values (
    p_report_id::text,
    v_report.status,
    'Verified and confirmed by Hall Rep ' || v_user.name,
    v_user.role,
    v_user.name,
    v_user.id::text
  );

  insert into public.notifications (user_id, type, report_id, report_description, message)
  values (
    v_report.student_id,
    'rep_action',
    p_report_id::text,
    v_report.location_name || ': ' || left(v_report.description, 45) || '...',
    'Hall Rep ' || v_user.name || ' verified and confirmed your report (+10 priority)'
  );

  return jsonb_build_object('success', true, 'new_score', v_new_score);
end;
$$;

create or replace function public.rep_dispute_report(p_report_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.profiles%rowtype;
  v_report public.reports%rowtype;
  v_new_score integer;
  v_already_acted boolean;
begin
  select * into v_user from public.profiles where id = auth.uid();
  if not found or v_user.role not in ('rep', 'admin') or v_user.is_banned then
    raise exception 'Unauthorized: Caller is not an active Hall Representative';
  end if;

  if length(trim(p_reason)) < 5 then
    raise exception 'Dispute reason must be at least 5 characters long';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  -- Hall restriction: Representative must represent the hall of the report (admins exempted)
  if v_user.role <> 'admin' then
    if v_report.hall is null or lower(trim(v_user.hall_or_dept)) <> lower(trim(v_report.hall)) then
      raise exception 'Unauthorized: Representative may only act on reports from their assigned hall';
    end if;
  end if;

  select exists (
    select 1 from public.status_events
    where report_id = p_report_id::text
      and actor_id = v_user.id::text
      and (note ilike '%Verified and confirmed by Hall Rep%' or note ilike '%Disputed by Hall Rep%')
  ) into v_already_acted;

  if v_already_acted then
    raise exception 'Representative has already taken action on this report';
  end if;

  perform set_config('campusfix.trusted_context', 'true', true);

  v_new_score := greatest(0, v_report.verification_score - 5);

  update public.reports
  set verification_score = v_new_score
  where id = p_report_id;

  insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
  values (
    p_report_id::text,
    v_report.status,
    'Disputed by Hall Rep ' || v_user.name || ': ' || trim(p_reason),
    v_user.role,
    v_user.name,
    v_user.id::text
  );

  insert into public.notifications (user_id, type, report_id, report_description, message)
  values (
    v_report.student_id,
    'rep_action',
    p_report_id::text,
    v_report.location_name || ': ' || left(v_report.description, 45) || '...',
    'Hall Rep ' || v_user.name || ' disputed your report: ' || trim(p_reason)
  );

  return jsonb_build_object('success', true, 'new_score', v_new_score);
end;
$$;

-- ============================================================================
-- TRUSTED ADMIN GOVERNANCE FUNCTIONS
-- ============================================================================
create or replace function public.admin_update_user_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  select * into v_admin from public.profiles where id = auth.uid();
  if not found or v_admin.role != 'admin' or v_admin.is_banned then
    raise exception 'Unauthorized: Administrator access required';
  end if;

  if p_role not in ('student', 'rep', 'staff', 'admin') then
    raise exception 'Invalid role specified';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Target user not found';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  -- If demoted from rep, mark any approved requests as stepped_down
  if v_target.role = 'rep' and p_role != 'rep' then
    update public.hall_rep_requests
    set status = 'stepped_down',
        rejection_reason = 'Role updated by Administrator in User Directory',
        reviewed_at = now(),
        reviewed_by = v_admin.name
    where user_id = p_user_id and status = 'approved';
  end if;

  insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
  values (
    'SYSTEM_AUDIT',
    'open',
    'Admin updated role for ' || v_target.name || ' to ' || p_role,
    'admin',
    v_admin.name,
    v_admin.id::text
  );

  return jsonb_build_object('success', true, 'new_role', p_role);
end;
$$;

create or replace function public.admin_ban_user(p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  select * into v_admin from public.profiles where id = auth.uid();
  if not found or v_admin.role != 'admin' or v_admin.is_banned then
    raise exception 'Unauthorized: Administrator access required';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Target user not found';
  end if;

  update public.profiles
  set is_banned = true, ban_reason = p_reason
  where id = p_user_id;

  insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
  values (
    'SYSTEM_AUDIT',
    'open',
    'Admin suspended account for ' || v_target.name || '. Reason: ' || p_reason,
    'admin',
    v_admin.name,
    v_admin.id::text
  );

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_unban_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  select * into v_admin from public.profiles where id = auth.uid();
  if not found or v_admin.role != 'admin' or v_admin.is_banned then
    raise exception 'Unauthorized: Administrator access required';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Target user not found';
  end if;

  update public.profiles
  set is_banned = false, ban_reason = null
  where id = p_user_id;

  insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
  values (
    'SYSTEM_AUDIT',
    'open',
    'Admin reinstated account access for ' || v_target.name,
    'admin',
    v_admin.name,
    v_admin.id::text
  );

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  select * into v_admin from public.profiles where id = auth.uid();
  if not found or v_admin.role != 'admin' or v_admin.is_banned then
    raise exception 'Unauthorized: Administrator access required';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Target user not found';
  end if;

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;

  insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
  values (
    'SYSTEM_AUDIT',
    'open',
    'Admin permanently deleted user account: ' || v_target.name,
    'admin',
    v_admin.name,
    v_admin.id::text
  );

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_review_rep_request(p_request_id uuid, p_approved boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.profiles%rowtype;
  v_req public.hall_rep_requests%rowtype;
  v_next_status text;
begin
  select * into v_admin from public.profiles where id = auth.uid();
  if not found or v_admin.role != 'admin' or v_admin.is_banned then
    raise exception 'Unauthorized: Administrator access required';
  end if;

  select * into v_req from public.hall_rep_requests where id = p_request_id;
  if not found then
    raise exception 'Request not found';
  end if;

  v_next_status := case when p_approved then 'approved' else 'rejected' end;

  update public.hall_rep_requests
  set status = v_next_status,
      rejection_reason = case when p_approved then null else p_reason end,
      reviewed_at = now(),
      reviewed_by = v_admin.name
  where id = p_request_id;

  if p_approved then
    update public.profiles
    set role = 'rep',
        hall_or_dept = v_req.hall
    where id = v_req.user_id;

    insert into public.notifications (user_id, type, report_id, report_description, message)
    values (
      v_req.user_id,
      'rep_request',
      'SYSTEM_NOTIFICATION',
      'Hall Rep Appointment: ' || v_req.hall,
      'Congratulations! Your application to serve as Hall Representative for ' || v_req.hall || ' has been approved by Administration.'
    );

    insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
    values (
      'SYSTEM_AUDIT',
      'open',
      'Admin approved ' || v_req.user_name || ' as Hall Representative for ' || v_req.hall,
      'admin',
      v_admin.name,
      v_admin.id::text
    );
  else
    insert into public.notifications (user_id, type, report_id, report_description, message)
    values (
      v_req.user_id,
      'rep_request',
      'SYSTEM_NOTIFICATION',
      'Hall Rep Application: ' || v_req.hall,
      'Your application for Hall Representative of ' || v_req.hall || ' was declined: ' || coalesce(p_reason, 'Criteria not met at this time.')
    );

    insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
    values (
      'SYSTEM_AUDIT',
      'open',
      'Admin declined Hall Rep application for ' || v_req.user_name || ' (' || v_req.hall || ')',
      'admin',
      v_admin.name,
      v_admin.id::text
    );
  end if;

  return jsonb_build_object('success', true, 'status', v_next_status);
end;
$$;

create or replace function public.admin_revoke_rep_status(p_user_id uuid, p_reason text default null, p_request_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_is_self boolean;
  v_reason text;
begin
  select * into v_caller from public.profiles where id = auth.uid();
  if not found or v_caller.is_banned then
    raise exception 'Unauthorized: Active session required';
  end if;

  v_is_self := (v_caller.id = p_user_id);
  if not v_is_self and v_caller.role != 'admin' then
    raise exception 'Unauthorized: Only administrators or the candidate can conclude an appointment';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Target user not found';
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), case when v_is_self then 'Candidate stepped down voluntarily as Hall Representative.' else 'Appointment concluded by University Administration.' end);

  update public.profiles
  set role = 'student'
  where id = p_user_id;

  if p_request_id is not null then
    update public.hall_rep_requests
    set status = 'stepped_down',
        rejection_reason = v_reason,
        reviewed_at = now(),
        reviewed_by = case when v_is_self then 'Self (Resigned)' else v_caller.name end
    where id = p_request_id;
  else
    update public.hall_rep_requests
    set status = 'stepped_down',
        rejection_reason = v_reason,
        reviewed_at = now(),
        reviewed_by = case when v_is_self then 'Self (Resigned)' else v_caller.name end
    where user_id = p_user_id and status = 'approved';
  end if;

  insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
  values (
    'SYSTEM_AUDIT',
    'open',
    case when v_is_self then v_target.name || ' stepped down voluntarily as Hall Representative' else 'Admin revoked Hall Representative status for ' || v_target.name || '. Note: ' || v_reason end,
    case when v_is_self then 'student' else 'admin' end,
    v_caller.name,
    v_caller.id::text
  );

  insert into public.notifications (user_id, type, report_id, report_description, message)
  values (
    p_user_id,
    'rep_request',
    'SYSTEM_AUDIT',
    'Hall Rep Appointment Status',
    case when v_is_self then 'You have stepped down as Hall Representative. Your account has returned to standard Student access.' else 'Your Hall Representative appointment has concluded. Reason: ' || v_reason end
  );

  return jsonb_build_object('success', true);
end;
$$;

-- Secure Staff Provisioning via Database Function (Runs in PostgreSQL, Zero Edge Server Needed)
create or replace function public.admin_create_staff_user(
  p_email text,
  p_password text,
  p_name text,
  p_dept text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_admin public.profiles%rowtype;
  v_new_id uuid := gen_random_uuid();
  v_encrypted_pw text;
begin
  select * into v_admin from public.profiles where id = auth.uid();
  if not found or v_admin.role != 'admin' or v_admin.is_banned then
    raise exception 'Unauthorized: Administrator access required';
  end if;

  if exists (select 1 from auth.users where email = lower(trim(p_email))) then
    raise exception 'An account with this email already exists';
  end if;

  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    reauthentication_token,
    phone_change,
    phone_change_token,
    is_sso_user
  )
  values (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    lower(trim(p_email)),
    v_encrypted_pw,
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', 'staff', 'requires_password_change', true),
    jsonb_build_object('name', trim(p_name), 'hall_or_dept', trim(p_dept), 'role', 'staff', 'requires_password_change', true),
    now(),
    now(),
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    v_new_id,
    v_new_id,
    jsonb_build_object('sub', v_new_id::text, 'email', lower(trim(p_email))),
    'email',
    now(),
    now(),
    now()
  );

  -- Ensure profile row exists with staff role
  insert into public.profiles (
    id,
    name,
    email,
    hall_or_dept,
    role,
    requires_password_change,
    is_banned,
    created_at
  )
  values (
    v_new_id,
    trim(p_name),
    lower(trim(p_email)),
    trim(p_dept),
    'staff',
    true,
    false,
    now()
  )
  on conflict (id) do update set
    role = 'staff',
    requires_password_change = true;

  insert into public.status_events (report_id, status, note, actor_role, actor_name, actor_id)
  values (
    'SYSTEM_AUDIT',
    'open',
    'Admin onboarded facilities staff member ' || trim(p_name) || ' (' || trim(p_dept) || ')',
    'admin',
    v_admin.name,
    v_admin.id::text
  );

  return jsonb_build_object('success', true, 'id', v_new_id, 'email', lower(trim(p_email)));
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
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
alter table public.allowed_email_domains enable row level security;

-- PROFILES RLS
drop policy if exists "Select own profile or admin" on public.profiles;
create policy "Select own profile or admin" on public.profiles
  for select using (
    id = auth.uid() or public.is_admin()
  );

-- For displaying creator names, roles, and halls on reports without revealing emails
create or replace view public.public_profiles as
  select id, name, hall_or_dept, role, created_at
  from public.profiles
  where is_banned = false;

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update using (
    (id = auth.uid() or public.is_admin()) and not is_banned
  );

drop policy if exists "Delete profile admin only" on public.profiles;
create policy "Delete profile admin only" on public.profiles
  for delete using (
    public.is_admin()
  );

-- LOCATIONS RLS
drop policy if exists "Select locations" on public.locations;
create policy "Select locations" on public.locations
  for select using (public.is_active_user());

drop policy if exists "Modify locations admin only" on public.locations;
create policy "Modify locations admin only" on public.locations
  for all using (public.is_admin());

-- REPORTS RLS
drop policy if exists "Select reports" on public.reports;
create policy "Select reports" on public.reports
  for select using (public.is_active_user());

drop policy if exists "Insert reports authenticated" on public.reports;
create policy "Insert reports authenticated" on public.reports
  for insert with check (
    public.is_active_user() and student_id = auth.uid() and status = 'open'
  );

drop policy if exists "Update reports staff or admin" on public.reports;
create policy "Update reports staff or admin" on public.reports
  for update using (
    public.is_staff() or public.is_admin()
  );

drop policy if exists "Delete reports admin only" on public.reports;
create policy "Delete reports admin only" on public.reports
  for delete using (public.is_admin());

-- CORROBORATIONS RLS
drop policy if exists "Select corroborations" on public.corroborations;
create policy "Select corroborations" on public.corroborations
  for select using (public.is_active_user());

drop policy if exists "Insert corroborations own only" on public.corroborations;
create policy "Insert corroborations own only" on public.corroborations
  for insert with check (
    public.is_active_user() and student_id = auth.uid()
  );

-- No updates or deletes on corroborations
drop policy if exists "No delete corroborations" on public.corroborations;
drop policy if exists "No update corroborations" on public.corroborations;

-- STATUS EVENTS RLS (APPEND-ONLY IMMUTABLE AUDIT TRAIL)
drop policy if exists "Select status_events" on public.status_events;
create policy "Select status_events" on public.status_events
  for select using (public.is_active_user());

drop policy if exists "Insert status_events" on public.status_events;
create policy "Insert status_events" on public.status_events
  for insert with check (
    public.is_active_user()
    and actor_id = auth.uid()::text
    and actor_role = public.current_role()
  );

-- Zero update or delete policies created on status_events (strictly immutable!)

-- COMMENTS RLS
drop policy if exists "Select comments" on public.comments;
create policy "Select comments" on public.comments
  for select using (public.is_active_user());

drop policy if exists "Insert comments" on public.comments;
create policy "Insert comments" on public.comments
  for insert with check (
    public.is_active_user() and author_id = auth.uid()
  );

-- Automated trigger: notify report author on new comment
create or replace function public.on_comment_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
begin
  select * into v_report from public.reports where id = new.report_id;
  if found and v_report.student_id <> new.author_id then
    insert into public.notifications (user_id, type, report_id, report_description, message)
    values (
      v_report.student_id,
      'comment',
      new.report_id::text,
      v_report.location_name || ': ' || left(v_report.description, 45) || '...',
      new.author_name || ' (' || new.author_role || ') commented: "' || left(new.text, 50) || (case when length(new.text) > 50 then '..."' else '"' end)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_on_comment_inserted on public.comments;
create trigger tr_on_comment_inserted
  after insert on public.comments
  for each row
  execute function public.on_comment_inserted();

-- Automated trigger: notify report author on status update
create or replace function public.on_report_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, type, report_id, report_description, message)
    values (
      new.student_id,
      'status_change',
      new.id::text,
      new.location_name || ': ' || left(new.description, 45) || '...',
      'Your report status changed to ' || replace(new.status, '_', ' ')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_on_report_status_changed on public.reports;
create trigger tr_on_report_status_changed
  after update on public.reports
  for each row
  execute function public.on_report_status_changed();

-- INTERNAL NOTES RLS (STAFF & ADMIN ONLY)
drop policy if exists "Select internal_notes" on public.internal_notes;
create policy "Select internal_notes" on public.internal_notes
  for select using (public.is_staff());

drop policy if exists "Insert internal_notes" on public.internal_notes;
create policy "Insert internal_notes" on public.internal_notes
  for insert with check (
    public.is_staff() and author_id = auth.uid()
  );

drop policy if exists "Update internal_notes" on public.internal_notes;
create policy "Update internal_notes" on public.internal_notes
  for update using (
    public.is_staff() and author_id = auth.uid()
  );

drop policy if exists "Delete internal_notes" on public.internal_notes;
create policy "Delete internal_notes" on public.internal_notes
  for delete using (
    public.is_staff() and (author_id = auth.uid() or public.is_admin())
  );

-- VERIFICATION SIGNALS RLS (READ ONLY, INSERT VIA TRIGGERS)
drop policy if exists "Select verification_signals" on public.verification_signals;
create policy "Select verification_signals" on public.verification_signals
  for select using (public.is_active_user());

-- NOTIFICATIONS RLS (READ & MARK READ ONLY FOR RECIPIENT; NO CLIENT INSERTS)
drop policy if exists "Select own notifications" on public.notifications;
create policy "Select own notifications" on public.notifications
  for select using (
    user_id = auth.uid() or user_id is null
  );

drop policy if exists "Update own notifications" on public.notifications;
create policy "Update own notifications" on public.notifications
  for update using (
    user_id = auth.uid()
  );

-- Direct client inserts disabled to prevent notification forgery
drop policy if exists "Insert notifications" on public.notifications;

-- HALL REP REQUESTS RLS
drop policy if exists "Select hall_rep_requests" on public.hall_rep_requests;
create policy "Select hall_rep_requests" on public.hall_rep_requests
  for select using (
    user_id = auth.uid() or public.is_admin()
  );

drop policy if exists "Insert own hall_rep_requests" on public.hall_rep_requests;
create policy "Insert own hall_rep_requests" on public.hall_rep_requests
  for insert with check (
    public.is_active_user() and user_id = auth.uid()
  );

drop policy if exists "Update hall_rep_requests admin only" on public.hall_rep_requests;
create policy "Update hall_rep_requests admin only" on public.hall_rep_requests
  for update using (
    public.is_admin()
  );

-- ALLOWED_EMAIL_DOMAINS RLS (ADMIN ONLY; CLOSED TO CLIENT MUTATION)
drop policy if exists "Select allowed_email_domains admin only" on public.allowed_email_domains;
create policy "Select allowed_email_domains admin only" on public.allowed_email_domains
  for select using (public.is_admin());

drop policy if exists "Modify allowed_email_domains admin only" on public.allowed_email_domains;
create policy "Modify allowed_email_domains admin only" on public.allowed_email_domains
  for all using (public.is_admin());

-- CAMPUS_UNITS RLS (PUBLIC READABLE, ADMIN MUTABLE)
alter table public.campus_units enable row level security;

drop policy if exists "Select campus_units" on public.campus_units;
create policy "Select campus_units" on public.campus_units
  for select using (true);

drop policy if exists "Insert campus_units admin only" on public.campus_units;
create policy "Insert campus_units admin only" on public.campus_units
  for insert with check (public.is_admin());

drop policy if exists "Update campus_units admin only" on public.campus_units;
create policy "Update campus_units admin only" on public.campus_units
  for update using (public.is_admin());

drop policy if exists "Delete campus_units admin only" on public.campus_units;
create policy "Delete campus_units admin only" on public.campus_units
  for delete using (public.is_admin());

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

drop policy if exists "Allow Authenticated Uploads to User Folder" on storage.objects;
create policy "Allow Authenticated Uploads to User Folder" on storage.objects
  for insert with check (
    bucket_id = 'report-photos'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Allow Deletion by Owner or Admin" on storage.objects;
create policy "Allow Deletion by Owner or Admin" on storage.objects
  for delete using (
    bucket_id = 'report-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ============================================================================
-- REALTIME PUBLICATION SUBSCRIPTIONS
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
    public.hall_rep_requests,
    public.campus_units;
exception
  when others then
    null;
end $$;

-- ============================================================================
-- API ROLE PERMISSIONS (anon, authenticated, service_role)
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Reload PostgREST API schema cache
notify pgrst, 'reload schema';

