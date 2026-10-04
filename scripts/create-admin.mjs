#!/usr/bin/env node

/**
 * CampusFix - Interactive Admin Account Provisioning Script
 *
 * Prompts for administrator details in the terminal and provisions
 * the admin profile directly in the Supabase PostgreSQL database.
 *
 * Usage:
 *   node scripts/create-admin.mjs
 *   npm run create-admin
 */

import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// 1. Resolve Supabase credentials (from environment, .env.local, or project defaults)
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Parse .env.local if present
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
      if (key === 'NEXT_PUBLIC_SUPABASE_URL' && !supabaseUrl) supabaseUrl = val;
      if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && !supabaseKey) supabaseKey = val;
    }
  } catch (e) {
    // Ignore .env read notice
  }
}

// Fallback to project defaults from lib/supabase.ts
if (!supabaseUrl) {
  supabaseUrl = 'https://auedssowxperapcdkuaf.supabase.co';
}
if (!supabaseKey) {
  supabaseKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZWRzc293eHBlcmFwY2RrdWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODI0MDEsImV4cCI6MjEwNDY1ODQwMX0.PXBJ18Gt1C3HWRQ6anXEeFh4yj-UwtZqENjouF6L4uE';
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\n======================================================');
  console.log('       CampusFix: Administrator Account Provisioning   ');
  console.log('======================================================');
  console.log(`Connecting to database: ${supabaseUrl}\n`);

  // 1. Full Name
  let name = '';
  while (!name) {
    name = await ask('1. Admin Full Name (e.g. Dr. Melvin Mensah): ');
    if (!name) console.log('   Error: Name cannot be empty. Please enter a valid name.');
  }

  // 2. Email
  let email = '';
  while (!email) {
    const inputEmail = await ask('2. University Email (e.g. admin@university.edu.gh): ');
    const clean = inputEmail.toLowerCase();
    if (!clean || !clean.includes('@')) {
      console.log('   Error: Please enter a valid email address.');
      continue;
    }
    if (!clean.endsWith('@university.edu.gh') && !clean.endsWith('.edu.gh') && !clean.endsWith('.gh')) {
      console.log('   Note: Using recommended university format for campus operations.');
    }
    email = clean;
  }

  // 3. Department
  const defaultDept = 'Central Administration';
  const inputDept = await ask(`3. Department / Admin Unit [${defaultDept}]: `);
  const department = inputDept || defaultDept;

  // 4. Password
  let password = '';
  while (!password) {
    const inputPass = await ask('4. Password (min 6 characters): ');
    if (!inputPass || inputPass.length < 6) {
      console.log('   Error: Password must be at least 6 characters long.');
      continue;
    }
    password = inputPass;
  }

  console.log('\nChecking database for existing profile...');

  // Check if profile with this email already exists
  const { data: existing, error: checkError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (checkError) {
    console.error(`Database query error: ${checkError.message}`);
    rl.close();
    process.exit(1);
  }

  let adminUser = null;

  if (existing) {
    console.log(`\nFound existing account for ${email}:`);
    console.log(`   - Name: ${existing.name}`);
    console.log(`   - Current Role: ${existing.role}`);
    console.log(`   - Department/Hall: ${existing.hall_or_dept}`);

    const confirm = await ask('\nPromote this account to Administrator and update password? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('\nOperation cancelled. No changes were made.');
      rl.close();
      process.exit(0);
    }

    const updatePayload = {
      name,
      hall_or_dept: department,
      role: 'admin',
      temp_passkey: password,
      requires_password_change: false,
      is_banned: false,
    };

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updateError) {
      console.error(`\nFailed to update account: ${updateError.message}`);
      rl.close();
      process.exit(1);
    }

    adminUser = updated;
    console.log('\nAccount successfully updated and promoted to Administrator!');
  } else {
    const newId = `u-admin-${Date.now()}`;
    const insertPayload = {
      id: newId,
      name,
      email,
      hall_or_dept: department,
      role: 'admin',
      temp_passkey: password,
      requires_password_change: false,
      is_banned: false,
      onboarded_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError) {
      console.error(`\nFailed to create admin profile: ${insertError.message}`);
      rl.close();
      process.exit(1);
    }

    adminUser = inserted;
    console.log('\nAdmin profile successfully created in database!');
  }

  console.log('\n======================================================');
  console.log('             ADMIN ACCOUNT READY FOR USE              ');
  console.log('======================================================');
  console.log(`  Name:        ${adminUser.name}`);
  console.log(`  Email:       ${adminUser.email}`);
  console.log(`  Department:  ${adminUser.hall_or_dept}`);
  console.log(`  Role:        ${adminUser.role.toUpperCase()}`);
  console.log(`  Password:    ${password}`);
  console.log('======================================================');
  console.log('\nYou can now sign in at:');
  console.log('  Live App:    https://campus-maintenance-report-system.onrender.com');
  console.log('  Local Dev:   http://localhost:3000\n');

  rl.close();
}

main().catch((err) => {
  console.error('\nUnexpected error during admin creation:', err);
  rl.close();
  process.exit(1);
});
