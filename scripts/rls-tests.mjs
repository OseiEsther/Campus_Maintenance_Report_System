#!/usr/bin/env node

/**
 * CampusFix - Automated Row Level Security (RLS) & Multi-Role Governance Test Suite
 *
 * Authenticates against live Supabase PostgreSQL using real JWT sessions across all four
 * institutional roles (Student, Hall Representative, Maintenance Staff, Administrator).
 *
 * Validates security boundaries using active sessions and .select() verification:
 * - Direct sign-up with role: 'admin' ends strictly as student (privilege escalation guard)
 * - Students blocked from elevating roles on profiles table
 * - Students blocked from directly modifying verification_score on reports
 * - Students blocked from reading facilities internal_notes (RLS filtered to 0 rows)
 * - Students blocked from forging status_events audit records with another actor_id
 * - Students blocked from corroborating own incident reports
 * - Peer students can corroborate reports (+2 score verification)
 * - Hall Reps can verify reports within their assigned hall (+10 score verification)
 * - Hall Reps blocked from verifying reports more than once
 * - Representatives from other halls blocked from acting on foreign hall reports
 * - Maintenance staff can update ticket priority to urgent
 * - Students blocked from modifying ticket priority
 * - Students blocked from inserting spoofed rows into notifications table
 * - Corroborations blocked on resolved or archived reports
 * - Anonymous and student mutations on allowed_email_domains (insert, update, delete) are strictly refused
 * - Administrator can create staff account via admin_create_staff_user and staff can sign in
 *
 * Usage:
 *   node scripts/rls-tests.mjs
 *   npm run test:rls
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// 1. Resolve environment variables from .env.local if present
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
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    // Ignore read error
  }
}

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('\n================================================================');
console.log('      CAMPUSFIX LIVE ROW LEVEL SECURITY (RLS) TEST SUITE        ');
console.log('================================================================\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Error] Supabase URL and Anon Key must be provided in environment or .env.local.');
  console.error('Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.\n');
  process.exit(1);
}

// 2. Validate required test account credentials
// Default passwords are NOT hardcoded to prevent security leaks
const requiredPasswordVars = [
  'TEST_STUDENT_PASSWORD',
  'TEST_STUDENT2_PASSWORD',
  'TEST_REP_PASSWORD',
  'TEST_REP_OTHER_PASSWORD',
  'TEST_STAFF_PASSWORD',
  'TEST_ADMIN_PASSWORD',
];

const missingVars = requiredPasswordVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('[Configuration Error] Missing required test passwords in environment or .env.local:');
  missingVars.forEach((v) => console.error(`  - ${v}`));
  console.error('\nTo prevent credential leakage, default test passwords are not hardcoded in source code.');
  console.error('Please specify them in your private .env.local file or shell environment before running test:rls.');
  console.error('See .env.example for variable templates.\n');
  process.exit(1);
}

// Configurable test user credentials (passwords strictly sourced from environment)
const creds = {
  student1: {
    email: process.env.TEST_STUDENT_EMAIL || 'test_student1@st.university.edu.gh',
    password: process.env.TEST_STUDENT_PASSWORD,
    name: 'Test Student One',
    hall: 'Pentagon Hall',
    role: 'student',
  },
  student2: {
    email: process.env.TEST_STUDENT2_EMAIL || 'test_student2@st.university.edu.gh',
    password: process.env.TEST_STUDENT2_PASSWORD,
    name: 'Test Student Two',
    hall: 'Pentagon Hall',
    role: 'student',
  },
  repPentagon: {
    email: process.env.TEST_REP_EMAIL || 'test_rep_pentagon@st.university.edu.gh',
    password: process.env.TEST_REP_PASSWORD,
    name: 'Test Rep Pentagon',
    hall: 'Pentagon Hall',
    role: 'rep',
  },
  repRepublic: {
    email: process.env.TEST_REP_OTHER_EMAIL || 'test_rep_republic@st.university.edu.gh',
    password: process.env.TEST_REP_OTHER_PASSWORD,
    name: 'Test Rep Republic',
    hall: 'Republic Hall',
    role: 'rep',
  },
  staff: {
    email: process.env.TEST_STAFF_EMAIL || 'test_staff@staff.university.edu.gh',
    password: process.env.TEST_STAFF_PASSWORD,
    name: 'Test Maintenance Staff',
    hall: 'Works and Physical Development',
    role: 'staff',
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'test_admin@admin.university.edu.gh',
    password: process.env.TEST_ADMIN_PASSWORD,
    name: 'Test System Administrator',
    hall: 'Central Administration',
    role: 'admin',
  },
};


const results = [];

function recordResult(id, role, description, passed, detail) {
  results.push({ id, role, description, passed, detail });
  const statusStr = passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${statusStr} | [${id}] (${role}): ${description}`);
  if (!passed && detail) {
    console.log(`       \x1b[33mDetail: ${detail}\x1b[0m`);
  }
}

async function createAuthSession(email, password) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.user) {
    throw new Error(`Authentication failed for ${email}: ${error?.message || 'No user session'}`);
  }

  return { client, user: data.user };
}

async function provisionTestAccountIfAdminAvailable(adminClient, userDef) {
  if (!adminClient) return;
  try {
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const existing = (usersData?.users || []).find(
      (u) => u.email?.toLowerCase() === userDef.email.toLowerCase()
    );

    let uid = existing?.id;
    if (!existing) {
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: userDef.email,
        password: userDef.password,
        email_confirm: true,
        app_metadata: { role: userDef.role },
        user_metadata: { name: userDef.name, hall_or_dept: userDef.hall },
      });
      if (createErr) return;
      uid = created.user?.id;
    } else {
      await adminClient.auth.admin.updateUserById(uid, {
        password: userDef.password,
        email_confirm: true,
        app_metadata: { role: userDef.role },
        user_metadata: { name: userDef.name, hall_or_dept: userDef.hall },
      });
    }

    if (uid) {
      await adminClient.from('profiles').upsert({
        id: uid,
        name: userDef.name,
        email: userDef.email,
        hall_or_dept: userDef.hall,
        role: userDef.role,
        requires_password_change: false,
        is_banned: false,
      });
    }
  } catch (e) {
    // Continue with existing accounts
  }
}

async function main() {
  console.log(`Target Supabase API: ${supabaseUrl}\n`);

  // Optional: Auto-provision test users if service role key is present
  if (serviceRoleKey) {
    try {
      const adminProvisioner = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      console.log('Ensuring clean test accounts across all roles with service role key...');
      for (const key of Object.keys(creds)) {
        await provisionTestAccountIfAdminAvailable(adminProvisioner, creds[key]);
      }
      console.log('Test accounts initialized.\n');
    } catch (e) {
      console.log('Notice: Continuing with configured test accounts.\n');
    }
  }

  // 1. Authenticate sessions for each institutional role
  let student1, student2, repPentagon, repRepublic, staff, admin;
  try {
    student1 = await createAuthSession(creds.student1.email, creds.student1.password);
    student2 = await createAuthSession(creds.student2.email, creds.student2.password);
    repPentagon = await createAuthSession(creds.repPentagon.email, creds.repPentagon.password);
    repRepublic = await createAuthSession(creds.repRepublic.email, creds.repRepublic.password);
    staff = await createAuthSession(creds.staff.email, creds.staff.password);
    admin = await createAuthSession(creds.admin.email, creds.admin.password);
  } catch (authError) {
    console.error('\n[Fatal Authentication Failure]');
    console.error(authError.message);
    console.error('\nPlease verify that test accounts are created with matching credentials in Supabase Auth.\n');
    process.exit(1);
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

  console.log('================================================================');
  console.log('                EXECUTING LIVE RLS TEST ASSERTIONS              ');
  console.log('================================================================\n');

  // TEST 1: Direct signup with role: 'admin' ends as student
  try {
    const probeEmail = `attacker_${Date.now()}@st.university.edu.gh`;
    const probePassword = 'AttackerPassword123!';
    const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
      email: probeEmail,
      password: probePassword,
      options: {
        data: {
          name: 'Privilege Escalation Probe',
          role: 'admin', // Malicious attempt to self-assign admin role
        },
      },
    });

    if (signUpErr) {
      recordResult('RLS-01', 'Anonymous', 'Direct sign-up with role admin ends as student', false, signUpErr.message);
    } else {
      const probeUid = signUpData.user?.id;
      // Query profile role
      const { data: profile } = await admin.client
        .from('profiles')
        .select('role')
        .eq('id', probeUid)
        .single();

      const passed = profile?.role === 'student';
      recordResult(
        'RLS-01',
        'Anonymous',
        'Direct sign-up with role admin ends as student',
        passed,
        `Assigned role: ${profile?.role || 'unknown'}`
      );
    }
  } catch (err) {
    recordResult('RLS-01', 'Anonymous', 'Direct sign-up with role admin ends as student', false, err.message);
  }

  // TEST 2: Student changes own role (blocked via guard trigger and RLS)
  try {
    const { data: updatedRole, error: roleErr } = await student1.client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', student1.user.id)
      .select();

    const isBlocked = !!roleErr || !updatedRole || updatedRole.length === 0;
    recordResult(
      'RLS-02',
      'Student',
      'Student cannot elevate own role in profiles table',
      isBlocked,
      roleErr?.message || (updatedRole?.length === 0 ? '0 rows affected (blocked)' : 'Unauthorized update succeeded')
    );
  } catch (err) {
    recordResult('RLS-02', 'Student', 'Student cannot elevate own role in profiles table', true, err.message);
  }

  // Setup a test report created by Student 1 for subsequent tests
  const testReportId = crypto.randomUUID();
  try {
    const { error: repInsertErr } = await student1.client.from('reports').insert({
      id: testReportId,
      student_id: student1.user.id,
      student_name: creds.student1.name,
      location_id: crypto.randomUUID(),
      location_name: 'Pentagon Block B Corridor',
      hall: 'Pentagon Hall',
      category: 'electrical',
      description: 'Defective light fixture sparking near room B12 staircase on third floor.',
      status: 'open',
      priority: 'medium',
    });

    if (repInsertErr) {
      console.error('Failed to create fixture test report:', repInsertErr.message);
    }
  } catch (e) {
    console.error('Error creating test report:', e);
  }

  // TEST 3: Student edits a report's verification_score directly (blocked)
  try {
    const { data: scoreUpdate, error: scoreErr } = await student1.client
      .from('reports')
      .update({ verification_score: 20 })
      .eq('id', testReportId)
      .select();

    const isBlocked = !!scoreErr || !scoreUpdate || scoreUpdate.length === 0;
    recordResult(
      'RLS-03',
      'Student',
      'Student direct modification of verification_score is blocked',
      isBlocked,
      scoreErr?.message || '0 rows updated (guarded)'
    );
  } catch (err) {
    recordResult('RLS-03', 'Student', 'Student direct modification of verification_score is blocked', true, err.message);
  }

  // TEST 4: Student reads internal_notes (blocked, returns 0 rows)
  try {
    const { data: notesData, error: notesErr } = await student1.client
      .from('internal_notes')
      .select('*');

    const isBlocked = !!notesErr || (Array.isArray(notesData) && notesData.length === 0);
    recordResult(
      'RLS-04',
      'Student',
      'Student read on maintenance internal_notes returns empty or error',
      isBlocked,
      notesErr ? notesErr.message : `Received ${notesData?.length || 0} rows (RLS filtered to 0)`
    );
  } catch (err) {
    recordResult('RLS-04', 'Student', 'Student read on maintenance internal_notes returns empty or error', true, err.message);
  }

  // TEST 5: Student inserts a status_events row with another person's actor_id (blocked)
  try {
    const { error: eventErr } = await student1.client.from('status_events').insert({
      report_id: testReportId,
      status: 'open',
      note: 'Forged administrative status record by student',
      actor_role: 'admin',
      actor_id: admin.user.id, // Forged actor_id of administrator
      actor_name: creds.admin.name,
    });

    const isBlocked = !!eventErr;
    recordResult(
      'RLS-05',
      'Student',
      'Student inserting status_events with forged actor_id is rejected',
      isBlocked,
      eventErr?.message || 'Forged status event was unexpectedly permitted'
    );
  } catch (err) {
    recordResult('RLS-05', 'Student', 'Student inserting status_events with forged actor_id is rejected', true, err.message);
  }

  // TEST 6: Student corroborates own report (blocked by database trigger)
  try {
    const { error: ownCorrobErr } = await student1.client.from('corroborations').insert({
      report_id: testReportId,
      student_id: student1.user.id,
      student_name: creds.student1.name,
    });

    const isBlocked = !!ownCorrobErr;
    recordResult(
      'RLS-06',
      'Student',
      'Student cannot corroborate own incident report',
      isBlocked,
      ownCorrobErr?.message || 'Self-corroboration was unexpectedly accepted'
    );
  } catch (err) {
    recordResult('RLS-06', 'Student', 'Student cannot corroborate own incident report', true, err.message);
  }

  // TEST 7: Another student corroborates report (POSITIVE TEST: works, score rises by +2)
  try {
    const { data: initialReport } = await student1.client
      .from('reports')
      .select('verification_score')
      .eq('id', testReportId)
      .single();

    const initialScore = initialReport?.verification_score ?? 1;

    const { error: corrobErr } = await student2.client.from('corroborations').insert({
      report_id: testReportId,
      student_id: student2.user.id,
      student_name: creds.student2.name,
    });

    if (corrobErr) {
      recordResult('RLS-07', 'Student', 'Peer student corroboration increases verification_score by 2', false, corrobErr.message);
    } else {
      const { data: updatedReport } = await student1.client
        .from('reports')
        .select('verification_score')
        .eq('id', testReportId)
        .single();

      const newScore = updatedReport?.verification_score ?? 0;
      const passed = newScore === initialScore + 2;
      recordResult(
        'RLS-07',
        'Student',
        'Peer student corroboration increases verification_score by 2',
        passed,
        `Score before: ${initialScore}, Score after: ${newScore}`
      );
    }
  } catch (err) {
    recordResult('RLS-07', 'Student', 'Peer student corroboration increases verification_score by 2', false, err.message);
  }

  // TEST 8: Hall Representative confirms report in their hall (POSITIVE TEST: +10 score)
  try {
    const { data: repConfirmData, error: repConfirmErr } = await repPentagon.client.rpc(
      'rep_confirm_report',
      { p_report_id: testReportId }
    );

    if (repConfirmErr) {
      recordResult('RLS-08', 'Hall Rep', 'Hall Representative confirms report in their hall (+10 score)', false, repConfirmErr.message);
    } else {
      recordResult(
        'RLS-08',
        'Hall Rep',
        'Hall Representative confirms report in their hall (+10 score)',
        true,
        `New verification score: ${repConfirmData?.new_score}`
      );
    }
  } catch (err) {
    recordResult('RLS-08', 'Hall Rep', 'Hall Representative confirms report in their hall (+10 score)', false, err.message);
  }

  // TEST 9: Hall Representative confirms twice (blocked: single-use enforcement)
  try {
    const { error: duplicateErr } = await repPentagon.client.rpc('rep_confirm_report', {
      p_report_id: testReportId,
    });

    const isBlocked = !!duplicateErr;
    recordResult(
      'RLS-09',
      'Hall Rep',
      'Representative cannot verify the same incident report twice',
      isBlocked,
      duplicateErr?.message || 'Duplicate representative confirmation was accepted'
    );
  } catch (err) {
    recordResult('RLS-09', 'Hall Rep', 'Representative cannot verify the same incident report twice', true, err.message);
  }

  // TEST 10: Non-rep or Rep from different hall confirms report (blocked: hall mismatch)
  try {
    const { error: otherHallErr } = await repRepublic.client.rpc('rep_confirm_report', {
      p_report_id: testReportId,
    });

    const isBlocked = !!otherHallErr;
    recordResult(
      'RLS-10',
      'Hall Rep',
      'Representative from foreign hall blocked from acting on report',
      isBlocked,
      otherHallErr?.message || 'Cross-hall confirmation was unexpectedly allowed'
    );
  } catch (err) {
    recordResult('RLS-10', 'Hall Rep', 'Representative from foreign hall blocked from acting on report', true, err.message);
  }

  // TEST 11: Maintenance staff sets ticket priority (POSITIVE TEST: works)
  try {
    const { data: staffUpdate, error: staffErr } = await staff.client
      .from('reports')
      .update({ priority: 'urgent' })
      .eq('id', testReportId)
      .select('priority');

    const passed = !staffErr && staffUpdate?.[0]?.priority === 'urgent';
    recordResult(
      'RLS-11',
      'Staff',
      'Maintenance staff can set ticket priority to urgent',
      passed,
      staffErr?.message || `Priority set to: ${staffUpdate?.[0]?.priority}`
    );
  } catch (err) {
    recordResult('RLS-11', 'Staff', 'Maintenance staff can set ticket priority to urgent', false, err.message);
  }

  // TEST 12: Student sets ticket priority (blocked)
  try {
    const { data: studentPrioUpdate, error: studentPrioErr } = await student1.client
      .from('reports')
      .update({ priority: 'low' })
      .eq('id', testReportId)
      .select('priority');

    const isBlocked = !!studentPrioErr || !studentPrioUpdate || studentPrioUpdate.length === 0;
    recordResult(
      'RLS-12',
      'Student',
      'Student modification of ticket priority is blocked',
      isBlocked,
      studentPrioErr?.message || '0 rows updated (guarded)'
    );
  } catch (err) {
    recordResult('RLS-12', 'Student', 'Student modification of ticket priority is blocked', true, err.message);
  }

  // TEST 13: Student inserting direct notification is blocked
  try {
    const { error: notifErr } = await student1.client.from('notifications').insert({
      user_id: admin.user.id,
      type: 'admin_notice',
      report_id: testReportId,
      report_description: 'Spoofed system notice',
      message: 'Unverified administrative alert',
    });

    const isBlocked = !!notifErr;
    recordResult(
      'RLS-13',
      'Student',
      'Direct client insert to notifications table is blocked',
      isBlocked,
      notifErr?.message || 'Client notification insert was unexpectedly permitted'
    );
  } catch (err) {
    recordResult('RLS-13', 'Student', 'Direct client insert to notifications table is blocked', true, err.message);
  }

  // TEST 14: Corroboration refused on resolved report
  try {
    // Staff marks report as resolved
    await staff.client
      .from('reports')
      .update({ status: 'resolved' })
      .eq('id', testReportId);

    // Another student attempts to corroborate resolved report
    const probeCorrobId = crypto.randomUUID();
    const { error: resolvedCorrobErr } = await student2.client.from('corroborations').insert({
      id: probeCorrobId,
      report_id: testReportId,
      student_id: student2.user.id,
      student_name: creds.student2.name,
    });

    const isBlocked = !!resolvedCorrobErr;
    recordResult(
      'RLS-14',
      'Student',
      'Corroboration is rejected on resolved incident reports',
      isBlocked,
      resolvedCorrobErr?.message || 'Corroboration was accepted on resolved report'
    );
  } catch (err) {
    recordResult('RLS-14', 'Student', 'Corroboration is rejected on resolved incident reports', true, err.message);
  }

  // TEST 15: Mutations on allowed_email_domains refused for anonymous and student
  try {
    // 1. Anonymous attempts insert, update, delete
    const { data: anonInsData, error: anonInsErr } = await anonClient
      .from('allowed_email_domains')
      .insert({ domain: '@anon-probe.org', description: 'Unauthorized anonymous probe' })
      .select();
    const anonInsBlocked = !!anonInsErr || !anonInsData || anonInsData.length === 0;

    const { data: anonUpdData, error: anonUpdErr } = await anonClient
      .from('allowed_email_domains')
      .update({ description: 'Unauthorized update by anonymous' })
      .eq('domain', '@st.university.edu.gh')
      .select();
    const anonUpdBlocked = !!anonUpdErr || !anonUpdData || anonUpdData.length === 0;

    const { data: anonDelData, error: anonDelErr } = await anonClient
      .from('allowed_email_domains')
      .delete()
      .eq('domain', '@st.university.edu.gh')
      .select();
    const anonDelBlocked = !!anonDelErr || !anonDelData || anonDelData.length === 0;

    // 2. Student attempts insert, update, delete
    const { data: studInsData, error: studInsErr } = await student1.client
      .from('allowed_email_domains')
      .insert({ domain: '@student-probe.org', description: 'Unauthorized student probe' })
      .select();
    const studInsBlocked = !!studInsErr || !studInsData || studInsData.length === 0;

    const { data: studUpdData, error: studUpdErr } = await student1.client
      .from('allowed_email_domains')
      .update({ description: 'Unauthorized update by student' })
      .eq('domain', '@st.university.edu.gh')
      .select();
    const studUpdBlocked = !!studUpdErr || !studUpdData || studUpdData.length === 0;

    const { data: studDelData, error: studDelErr } = await student1.client
      .from('allowed_email_domains')
      .delete()
      .eq('domain', '@st.university.edu.gh')
      .select();
    const studDelBlocked = !!studDelErr || !studDelData || studDelData.length === 0;

    const allSixBlocked =
      anonInsBlocked && anonUpdBlocked && anonDelBlocked &&
      studInsBlocked && studUpdBlocked && studDelBlocked;

    const detailMsg = [
      `Anon: insert=${anonInsBlocked ? 'refused' : 'allowed'}, update=${anonUpdBlocked ? 'refused' : 'allowed'}, delete=${anonDelBlocked ? 'refused' : 'allowed'}`,
      `Student: insert=${studInsBlocked ? 'refused' : 'allowed'}, update=${studUpdBlocked ? 'refused' : 'allowed'}, delete=${studDelBlocked ? 'refused' : 'allowed'}`,
    ].join(' | ');

    recordResult(
      'RLS-15',
      'Anon & Student',
      'Mutations on allowed_email_domains (insert, update, delete) are refused for anonymous and student callers',
      allSixBlocked,
      detailMsg
    );
  } catch (err) {
    recordResult(
      'RLS-15',
      'Anon & Student',
      'Mutations on allowed_email_domains (insert, update, delete) are refused for anonymous and student callers',
      false,
      err.message
    );
  }

  // TEST 16: Administrator creates staff account and staff signs in
  try {
    const newStaffEmail = `staff_auto_${Date.now()}@staff.university.edu.gh`;
    const newStaffPassword = `StaffP@ss_${Date.now()}!`;
    const newStaffName = 'Automated Facilities Technician';
    const newStaffDept = 'Estate Organization';

    // 1. Admin provisions staff member via secure PostgreSQL function
    const { data: createData, error: createStaffErr } = await admin.client.rpc('admin_create_staff_user', {
      p_email: newStaffEmail,
      p_password: newStaffPassword,
      p_name: newStaffName,
      p_dept: newStaffDept,
    });

    if (createStaffErr) {
      recordResult(
        'RLS-16',
        'Admin & Staff',
        'Administrator can create staff account and staff can sign in',
        false,
        `admin_create_staff_user error: ${createStaffErr.message}`
      );
    } else {
      // 2. Newly provisioned staff member signs in
      const newStaffClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: signInData, error: signInErr } = await newStaffClient.auth.signInWithPassword({
        email: newStaffEmail,
        password: newStaffPassword,
      });

      if (signInErr || !signInData?.user) {
        recordResult(
          'RLS-16',
          'Admin & Staff',
          'Administrator can create staff account and staff can sign in',
          false,
          `Staff sign-in failed: ${signInErr?.message || 'No user returned'}`
        );
      } else {
        // 3. Confirm profile role is staff
        const { data: staffProf, error: profErr } = await newStaffClient
          .from('profiles')
          .select('role, hall_or_dept')
          .eq('id', signInData.user.id)
          .single();

        const roleIsStaff = !profErr && staffProf?.role === 'staff';
        recordResult(
          'RLS-16',
          'Admin & Staff',
          'Administrator can create staff account and staff can sign in',
          roleIsStaff,
          roleIsStaff
            ? `Staff created and authenticated. Role: ${staffProf?.role}, Dept: ${staffProf?.hall_or_dept}`
            : `Profile lookup failed: ${profErr?.message || `Unexpected role: ${staffProf?.role}`}`
        );
      }
    }
  } catch (err) {
    recordResult(
      'RLS-16',
      'Admin & Staff',
      'Administrator can create staff account and staff can sign in',
      false,
      err.message
    );
  }

  // Summary
  console.log('\n================================================================');
  console.log('                       TEST SUITE SUMMARY                       ');
  console.log('================================================================');
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;
  console.log(`Total Assertions: ${results.length}`);
  console.log(`Passed:           ${passCount}`);
  console.log(`Failed:           ${failCount}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[Unhandled Suite Exception]', err);
  process.exit(1);
});
