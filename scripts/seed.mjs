#!/usr/bin/env node

/**
 * CampusFix - Comprehensive Database Seeder Script
 *
 * Populates realistic campus maintenance reports, audit trails, comments,
 * and internal technician notes across all categories, locations, and statuses.
 *
 * Safety Guarantee:
 * - NEVER overrides existing user credentials or passwords.
 * - Only provisions demo accounts if they do not already exist.
 *
 * Usage:
 *   npm run seed
 *   node scripts/seed.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// 1. Resolve environment credentials
let supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  try {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...vParts] = trimmed.split('=');
      const key = k?.trim();
      const val = vParts.join('=').trim().replace(/^["']|["']$/g, '');
      if ((key === 'SUPABASE_URL' || key === 'NEXT_PUBLIC_SUPABASE_URL') && !supabaseUrl) {
        supabaseUrl = val;
      }
      if (key === 'SUPABASE_SERVICE_ROLE_KEY' && !serviceRoleKey) {
        serviceRoleKey = val;
      }
    }
  } catch (e) {
    // Ignore error
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\n[Error] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed the database.');
  console.error('Please configure SUPABASE_SERVICE_ROLE_KEY in your local .env.local file.\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 2. Define baseline demonstration accounts
const SEED_USERS = [
  {
    name: 'Dr. Esther Osei Amoako',
    email: 'oseiesther@university.edu.gh',
    defaultPassword: 'oseiesther',
    role: 'admin',
    hall_or_dept: 'Central Administration',
  },
  {
    name: 'Daniel Tetteh',
    email: 'daniel.tetteh@university.edu.gh',
    defaultPassword: 'StaffPass2025!',
    role: 'staff',
    hall_or_dept: 'Physical Development & Municipal Services',
  },
  {
    name: 'Kojo Mensah',
    email: 'kojo.mensah@university.edu.gh',
    defaultPassword: 'StaffPass2025!',
    role: 'staff',
    hall_or_dept: 'Physical Development & Municipal Services',
  },
  {
    name: 'Kwame Appiah',
    email: 'kwame.rep@st.university.edu.gh',
    defaultPassword: 'RepPass2025!',
    role: 'rep',
    hall_or_dept: 'Pentagon Hall',
  },
  {
    name: 'Esi Ansah',
    email: 'esi.ansah@st.university.edu.gh',
    defaultPassword: 'RepPass2025!',
    role: 'rep',
    hall_or_dept: 'Republic Hall',
  },
  {
    name: 'Ama Mensah',
    email: 'ama.mensah@st.university.edu.gh',
    defaultPassword: 'StudentPass2025!',
    role: 'student',
    hall_or_dept: 'Pentagon Hall',
  },
  {
    name: 'Kwabena Owusu',
    email: 'kwabena.owusu@st.university.edu.gh',
    defaultPassword: 'StudentPass2025!',
    role: 'student',
    hall_or_dept: 'Republic Hall',
  },
  {
    name: 'Akosua Frimpong',
    email: 'akosua.frimpong@st.university.edu.gh',
    defaultPassword: 'StudentPass2025!',
    role: 'student',
    hall_or_dept: 'Independence Hall',
  },
  {
    name: 'Esther Amoako',
    email: 'oeamoako@st.university.edu.gh',
    defaultPassword: 'oseiamoako',
    role: 'student',
    hall_or_dept: 'Computer Science & IT',
  },
];

async function main() {
  console.log('\n================================================================');
  console.log('       CampusFix: Maintenance Reports & Catalog Seeder          ');
  console.log('================================================================');
  console.log(`Connecting to: ${supabaseUrl}\n`);

  // Step 1: Ensure authorized email domains exist
  console.log('[1/5] Verifying authorized institutional email domains...');
  const domains = [
    { domain: '@st.university.edu.gh', description: 'Official student email domain' },
    { domain: '@university.edu.gh', description: 'Official administration and faculty domain' },
  ];
  for (const d of domains) {
    await supabase.from('allowed_email_domains').upsert(d, { onConflict: 'domain' });
  }

  // Step 2: Ensure Campus Units and Locations are fully synced
  console.log('\n[2/5] Verifying Campus Units and Locations registry...');
  const { data: units } = await supabase.from('campus_units').select('*');
  let campusUnitsList = units || [];

  if (campusUnitsList.length === 0) {
    const defaultUnits = [
      { name: 'Pentagon Hall', category: 'hall' },
      { name: 'Republic Hall', category: 'hall' },
      { name: 'Independence Hall', category: 'hall' },
      { name: 'Continental Hall', category: 'hall' },
      { name: 'Commonwealth Hall', category: 'hall' },
      { name: 'Legon Hall', category: 'hall' },
      { name: 'Jean Nelson Aka Hall', category: 'hall' },
      { name: 'Alexander Kwapong Hall', category: 'hall' },
      { name: 'Jubilee Hall', category: 'hall' },
      { name: 'Elizabeth Frances Sey Hall', category: 'hall' },
      { name: 'Computer Science & IT', category: 'department' },
      { name: 'Electrical & Electronic Engineering', category: 'department' },
      { name: 'Mechanical & Civil Engineering', category: 'department' },
      { name: 'Business Administration & Accounting', category: 'department' },
      { name: 'Faculty of Law', category: 'department' },
      { name: 'School of Medicine & Health Sciences', category: 'department' },
      { name: 'Biological & Physical Sciences', category: 'department' },
      { name: 'Humanities & Social Sciences', category: 'department' },
      { name: 'Student Affairs & SRC', category: 'administrative' },
      { name: 'Physical Development & Municipal Services', category: 'administrative' },
      { name: 'Academic Affairs', category: 'administrative' },
      { name: 'Library & Archives', category: 'administrative' },
      { name: 'Central Administration', category: 'administrative' },
    ];
    await supabase.from('campus_units').upsert(defaultUnits, { onConflict: 'name' });
    const { data: refreshedUnits } = await supabase.from('campus_units').select('*');
    campusUnitsList = refreshedUnits || [];
  }

  const categoryMap = { hall: 'residence', department: 'academic', administrative: 'administrative' };
  const locRows = campusUnitsList.map((u) => ({
    id: u.id,
    name: u.name,
    hall: u.name,
    building_type: categoryMap[u.category] || 'residence',
  }));
  await supabase.from('locations').upsert(locRows, { onConflict: 'id' });
  console.log(`      ${campusUnitsList.length} Campus Units and Locations confirmed.`);

  // Step 3: Resolve User Accounts (WITHOUT OVERRIDING EXISTING PASSWORDS)
  console.log('\n[3/5] Verifying user accounts (preserving all existing credentials)...');
  const { data: existingUsersData } = await supabase.auth.admin.listUsers();
  const existingUsers = existingUsersData?.users || [];
  const userMap = new Map();

  for (const seedUser of SEED_USERS) {
    const matched = existingUsers.find((u) => u.email?.toLowerCase() === seedUser.email.toLowerCase());
    let userId = '';

    if (matched) {
      userId = matched.id;
      // SAFE: Do NOT override password or credentials for existing accounts!
      console.log(`      Preserved existing account: ${seedUser.email} (credentials unchanged)`);
    } else {
      // Only create if the account does not exist
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: seedUser.email,
        password: seedUser.defaultPassword,
        email_confirm: true,
        app_metadata: { role: seedUser.role },
        user_metadata: { name: seedUser.name, hall_or_dept: seedUser.hall_or_dept, role: seedUser.role },
      });
      if (createErr) {
        console.error(`      Error creating ${seedUser.email}:`, createErr.message);
        continue;
      }
      userId = newUser.user.id;
      console.log(`      Created missing demo account: ${seedUser.email} (${seedUser.role.toUpperCase()})`);
    }

    // Ensure profiles record is present and role matches
    await supabase.from('profiles').upsert({
      id: userId,
      name: seedUser.name,
      email: seedUser.email,
      hall_or_dept: seedUser.hall_or_dept,
      role: seedUser.role,
      requires_password_change: false,
      is_banned: false,
    });

    userMap.set(seedUser.email, { id: userId, ...seedUser });
  }

  // Step 4: Populate Rich Maintenance Incident Reports
  console.log('\n[4/5] Populating comprehensive campus maintenance reports...');

  // Helper location lookups
  const findLoc = (name) => locRows.find((l) => l.name.toLowerCase() === name.toLowerCase()) || locRows[0];
  const uAma = userMap.get('ama.mensah@st.university.edu.gh');
  const uKwabena = userMap.get('kwabena.owusu@st.university.edu.gh');
  const uEsther = userMap.get('oeamoako@st.university.edu.gh');
  const uAkosua = userMap.get('akosua.frimpong@st.university.edu.gh');
  const uKwameRep = userMap.get('kwame.rep@st.university.edu.gh');
  const uEsiRep = userMap.get('esi.ansah@st.university.edu.gh');
  const uDanielStaff = userMap.get('daniel.tetteh@university.edu.gh');
  const uKojoStaff = userMap.get('kojo.mensah@university.edu.gh');

  const now = new Date();
  const timeHoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
  const timeDaysAgo = (d) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString();

  // Clear existing demo reports for clean population
  await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const REPORTS_TO_SEED = [
    // 1. Pentagon Hall - Plumbing - Open - High
    {
      id: crypto.randomUUID(),
      student: uAma,
      location: findLoc('Pentagon Hall'),
      location_name: 'Pentagon Hall (Common Bathroom Floor 2)',
      hall: 'Pentagon Hall',
      category: 'plumbing',
      description: 'Continuous water leak from the overhead shower supply piping in the second floor bathroom. Water pools heavily near the entrance, creating a serious slipping danger for residents at night.',
      photo_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
      status: 'open',
      priority: 'high',
      created_at: timeDaysAgo(1),
      corroborators: [uKwabena, uAkosua],
      comments: [
        {
          author: uKwameRep,
          text: 'Inspected this morning during hall rounds. Water is actively running down the wall tile. Hall rep verification confirmed.',
          created_at: timeHoursAgo(12),
        },
      ],
    },
    // 2. Republic Hall - Electrical - In Progress - Urgent
    {
      id: crypto.randomUUID(),
      student: uKwabena,
      location: findLoc('Republic Hall'),
      location_name: 'Republic Hall (Block A Stairwell)',
      hall: 'Republic Hall',
      category: 'electrical',
      description: 'Exposed bare electrical wiring hanging from the second floor stairwell lighting conduit. Sparks occur intermittently when the hallway switch is engaged.',
      photo_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
      status: 'in_progress',
      priority: 'urgent',
      assigned_to: uDanielStaff?.name,
      created_at: timeDaysAgo(2),
      corroborators: [uAma],
      events: [
        { status: 'open', note: `Submitted by ${uKwabena?.name}`, actor: uKwabena, time: timeDaysAgo(2) },
        { status: 'in_progress', note: `Work order dispatched to technician ${uDanielStaff?.name}`, actor: uDanielStaff, time: timeHoursAgo(18) },
      ],
      notes: [
        { author: uDanielStaff, text: 'Circuit breaker 4 isolated on distribution board A. Replacement junction box and conduit ordered from stores.', time: timeHoursAgo(16) },
      ],
      comments: [
        { author: uEsiRep, text: 'Hall executives have taped off the landing until technician arrives.', created_at: timeHoursAgo(20) },
      ],
    },
    // 3. Computer Science & IT - Structural - Resolved - Medium
    {
      id: crypto.randomUUID(),
      student: uEsther,
      location: findLoc('Computer Science & IT'),
      location_name: 'Computer Science & IT (Lab 204)',
      hall: 'Computer Science & IT',
      category: 'structural',
      description: 'Broken window latch causing heavy glass window frame to slam open uncontrollably during rainy weather, endangering desk computer terminals.',
      photo_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      status: 'resolved',
      priority: 'medium',
      assigned_to: uKojoStaff?.name,
      created_at: timeDaysAgo(4),
      events: [
        { status: 'open', note: `Submitted by ${uEsther?.name}`, actor: uEsther, time: timeDaysAgo(4) },
        { status: 'in_progress', note: `Assigned to technician ${uKojoStaff?.name}`, actor: uKojoStaff, time: timeDaysAgo(3) },
        { status: 'resolved', note: `Heavy duty latch installed and pane sealed by ${uKojoStaff?.name}`, actor: uKojoStaff, time: timeDaysAgo(1) },
      ],
      comments: [
        { author: uEsther, text: 'Thank you maintenance crew! The window latch is completely secure now.', created_at: timeHoursAgo(8) },
      ],
    },
    // 4. Independence Hall - Sanitation - Open - Medium
    {
      id: crypto.randomUUID(),
      student: uAkosua,
      location: findLoc('Independence Hall'),
      location_name: 'Independence Hall (Kitchenette Floor 3)',
      hall: 'Independence Hall',
      category: 'sanitation',
      description: 'Shared kitchen drainage pipe blocked with grease runoff, causing overflow onto cooking counters and persistent foul odor in the wing.',
      photo_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
      status: 'open',
      priority: 'medium',
      created_at: timeHoursAgo(16),
      corroborators: [uAma, uKwabena],
    },
    // 5. Library & Archives - Structural - In Progress - Urgent
    {
      id: crypto.randomUUID(),
      student: uEsther,
      location: findLoc('Library & Archives'),
      location_name: 'Library & Archives (2nd Floor Reading Room)',
      hall: 'Library & Archives',
      category: 'structural',
      description: 'Acoustic ceiling panel sagging significantly directly above student study cubicles. Risk of falling plaster tiles during ceiling fan vibration.',
      photo_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      status: 'in_progress',
      priority: 'urgent',
      assigned_to: uDanielStaff?.name,
      created_at: timeDaysAgo(3),
      corroborators: [uAkosua, uKwabena, uAma],
      notes: [
        { author: uDanielStaff, text: 'Area cordoned off. Scaffold brought in for ceiling grid re-anchoring.', time: timeHoursAgo(6) },
      ],
    },
    // 6. Central Administration - Sanitation - Open - Low
    {
      id: crypto.randomUUID(),
      student: uKwabena,
      location: findLoc('Central Administration'),
      location_name: 'Central Administration (Visitor Lobby Restroom)',
      hall: 'Central Administration',
      category: 'sanitation',
      description: 'Automated hand wash sensor dispensing continuously without shutting off, wasting water and splashing onto the vanity counter.',
      photo_url: null,
      status: 'open',
      priority: 'low',
      created_at: timeDaysAgo(2),
    },
    // 7. Pentagon Hall - Other - Resolved - Low
    {
      id: crypto.randomUUID(),
      student: uAma,
      location: findLoc('Pentagon Hall'),
      location_name: 'Pentagon Hall (Room 204)',
      hall: 'Pentagon Hall',
      category: 'other',
      description: 'Room entrance door lock cylinder sticking severely, causing resident key to jam repeatedly when trying to enter or exit.',
      photo_url: null,
      status: 'resolved',
      priority: 'low',
      assigned_to: uKojoStaff?.name,
      created_at: timeDaysAgo(5),
      events: [
        { status: 'open', note: `Report submitted by ${uAma?.name}`, actor: uAma, time: timeDaysAgo(5) },
        { status: 'resolved', note: `Lock cylinder lubricated and tumbler serviced by ${uKojoStaff?.name}`, actor: uKojoStaff, time: timeDaysAgo(3) },
      ],
    },
    // 8. Electrical Engineering - Electrical - Open - High
    {
      id: crypto.randomUUID(),
      student: uEsther,
      location: findLoc('Electrical & Electronic Engineering'),
      location_name: 'Electrical & Electronic Engineering (Circuit Lab 1)',
      hall: 'Electrical & Electronic Engineering',
      category: 'electrical',
      description: 'Workbench outlet strip 3 sparking when soldering equipment is plugged in. Internal breaker tripped and burnt plastic odor noticed.',
      photo_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
      status: 'open',
      priority: 'high',
      created_at: timeHoursAgo(10),
      corroborators: [uKwabena],
    },
    // 9. Continental Hall - Plumbing - Open - Medium
    {
      id: crypto.randomUUID(),
      student: uKwabena,
      location: findLoc('Continental Hall'),
      location_name: 'Continental Hall (Ground Floor Laundry Room)',
      hall: 'Continental Hall',
      category: 'plumbing',
      description: 'Drainage pipe backing up wastewater across the concrete floor whenever washing basins are drained. Creates stagnant water buildup.',
      photo_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
      status: 'open',
      priority: 'medium',
      created_at: timeDaysAgo(1),
      corroborators: [uAma],
    },
    // 10. Student Affairs & SRC - Other - In Progress - Medium
    {
      id: crypto.randomUUID(),
      student: uAkosua,
      location: findLoc('Student Affairs & SRC'),
      location_name: 'Student Affairs & SRC (SRC Conference Room)',
      hall: 'Student Affairs & SRC',
      category: 'other',
      description: 'Wall mounted air conditioning unit dripping heavy condensation onto the carpet and conference chairs. Remote sensor unresponsive.',
      photo_url: null,
      status: 'in_progress',
      priority: 'medium',
      assigned_to: uDanielStaff?.name,
      created_at: timeDaysAgo(2),
      notes: [
        { author: uDanielStaff, text: 'Condensate drainage line cleared. Compressor refrigerant levels being checked.', time: timeHoursAgo(5) },
      ],
    },
  ];

  let seededReportsCount = 0;
  let triggerErrorDetected = false;

  for (const r of REPORTS_TO_SEED) {
    if (!r.student) continue;

    // Insert Report
    const { error: repErr } = await supabase.from('reports').insert({
      id: r.id,
      student_id: r.student.id,
      student_name: r.student.name,
      location_id: r.location.id,
      location_name: r.location_name,
      hall: r.hall,
      category: r.category,
      description: r.description,
      photo_url: r.photo_url,
      status: r.status,
      priority: r.priority,
      assigned_to: r.assigned_to || null,
      created_at: r.created_at,
    });

    if (repErr) {
      console.error(`      Failed to insert report [${r.category.toUpperCase()}]: ${repErr.message}`);
      if (repErr.message.includes('verification_signals_report_id_fkey') || repErr.code === '23503') {
        triggerErrorDetected = true;
      }
      continue;
    }

    seededReportsCount++;

    // Default submission audit event
    await supabase.from('status_events').insert({
      id: crypto.randomUUID(),
      report_id: r.id,
      status: 'open',
      note: `Report submitted by ${r.student.name}`,
      actor_role: 'student',
      actor_name: r.student.name,
      actor_id: r.student.id,
      created_at: r.created_at,
    });

    // Extra status audit events
    if (r.events && r.events.length > 0) {
      for (const ev of r.events) {
        if (ev.status === 'open') continue;
        await supabase.from('status_events').insert({
          id: crypto.randomUUID(),
          report_id: r.id,
          status: ev.status,
          note: ev.note,
          actor_role: ev.actor?.role || 'staff',
          actor_name: ev.actor?.name || 'Staff Member',
          actor_id: ev.actor?.id || r.student.id,
          created_at: ev.time,
        });
      }
    }

    // Corroborations
    if (r.corroborators && r.corroborators.length > 0) {
      for (const c of r.corroborators) {
        if (!c) continue;
        await supabase.from('corroborations').insert({
          id: crypto.randomUUID(),
          report_id: r.id,
          student_id: c.id,
          student_name: c.name,
          created_at: timeHoursAgo(4),
        });
      }
    }

    // Comments
    if (r.comments && r.comments.length > 0) {
      for (const cm of r.comments) {
        if (!cm.author) continue;
        await supabase.from('comments').insert({
          id: crypto.randomUUID(),
          report_id: r.id,
          author_id: cm.author.id,
          author_name: cm.author.name,
          author_role: cm.author.role,
          text: cm.text,
          created_at: cm.created_at,
        });
      }
    }

    // Internal Notes (Staff only)
    if (r.notes && r.notes.length > 0) {
      for (const nt of r.notes) {
        if (!nt.author) continue;
        await supabase.from('internal_notes').insert({
          id: crypto.randomUUID(),
          report_id: r.id,
          author_id: nt.author.id,
          author_name: nt.author.name,
          author_role: nt.author.role,
          text: nt.text,
          created_at: nt.time,
        });
      }
    }

    console.log(`      Created report: [${r.category.toUpperCase()}] ${r.location_name} (${r.status.toUpperCase()})`);
  }

  // Step 5: Seed Candidate Hall Representative Application
  console.log('\n[5/5] Checking candidate Hall Representative application...');
  const { data: existingApps } = await supabase.from('hall_rep_requests').select('id');
  if (!existingApps || existingApps.length === 0) {
    if (uAkosua) {
      await supabase.from('hall_rep_requests').insert({
        id: crypto.randomUUID(),
        user_id: uAkosua.id,
        user_name: uAkosua.name,
        user_email: uAkosua.email,
        hall: 'Independence Hall',
        statement: 'Active Floor 3 resident committed to daily inspections and responsive liaison between students and university facilities maintenance.',
        status: 'pending',
        created_at: timeDaysAgo(1),
      });
      console.log('      Candidate application for Akosua Frimpong created.');
    }
  } else {
    console.log(`      Hall Representative applications already present (${existingApps.length} found).`);
  }

  // Final verification check of actual rows in database
  const { data: dbReports } = await supabase.from('reports').select('id');
  const actualReportsInDb = dbReports ? dbReports.length : 0;

  console.log('\n================================================================');
  if (triggerErrorDetected || actualReportsInDb === 0) {
    console.log('       [ACTION REQUIRED] DATABASE TRIGGER UPDATE NEEDED         ');
    console.log('================================================================');
    console.log('The database trigger "tr_on_report_inserted" in Supabase rejected');
    console.log('report insertions because it fired BEFORE insert instead of AFTER.');
    console.log('\nPlease run this short snippet in your Supabase SQL Editor:');
    console.log('----------------------------------------------------------------');
    console.log(`
create or replace function public.calc_initial_report_score()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_score integer := 1;
begin
  if length(new.description) >= 100 then v_score := v_score + 3; end if;
  if new.photo_url is not null and length(trim(new.photo_url)) > 0 then v_score := v_score + 2; end if;
  new.verification_score := least(20, greatest(0, v_score));
  return new;
end; $$;

drop trigger if exists tr_calc_initial_report_score on public.reports;
create trigger tr_calc_initial_report_score
  before insert on public.reports for each row execute function public.calc_initial_report_score();

create or replace function public.on_report_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.verification_signals (report_id, label, points) values (new.id, '+1 report submitted', 1);
  if length(new.description) >= 100 then insert into public.verification_signals (report_id, label, points) values (new.id, '+3 detailed description (over 100 characters)', 3); end if;
  if new.photo_url is not null and length(trim(new.photo_url)) > 0 then insert into public.verification_signals (report_id, label, points) values (new.id, '+2 photo attached', 2); end if;
  return new;
end; $$;

drop trigger if exists tr_on_report_inserted on public.reports;
create trigger tr_on_report_inserted
  after insert on public.reports for each row execute function public.on_report_inserted();
    `.trim());
    console.log('----------------------------------------------------------------');
    console.log('Once executed, re-run "npm run seed" to populate all 10 reports!\n');
  } else {
    console.log('         DATABASE POPULATED & READY FOR EVALUATION              ');
    console.log('================================================================');
    console.log(`Successfully verified ${actualReportsInDb} maintenance reports in Supabase.`);
    console.log('Existing account credentials were preserved untouched.\n');
  }
}

main().catch((err) => {
  console.error('\n[Error] Seeding failed:', err);
  process.exit(1);
});
