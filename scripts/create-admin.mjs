#!/usr/bin/env node

/**
 * CampusFix - Secure Administrator Account Provisioning Script
 *
 * Runs locally using the Supabase Service Role Key to provision
 * real Supabase Auth admin accounts.
 *
 * Requirements:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in environment or .env.local
 *
 * Usage:
 *   node scripts/create-admin.mjs
 *   npm run create-admin
 */

import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// 1. Resolve Supabase credentials (from environment or .env.local)
let supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Parse .env.local if present in current directory
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
    // Ignore .env read error
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\n[CampusFix Security Error]');
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided to run this provisioning script.');
  console.error('Please configure SUPABASE_SERVICE_ROLE_KEY in your local .env.local file or shell environment.');
  console.error('Never commit the service role key to git or include it in client-side bundles.\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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
  console.log(`Connecting securely to: ${supabaseUrl}\n`);

  // 1. Full Name
  let name = '';
  while (!name) {
    name = await ask('1. Admin Full Name (e.g. Mrs. Esther Amoako): ');
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

  console.log('\nChecking Supabase Auth for existing user...');

  // Search existing users in Supabase Auth
  const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error(`Error querying auth users: ${listError.message}`);
    rl.close();
    process.exit(1);
  }

  const existingAuthUser = (userList.users || []).find(
    (u) => u.email?.toLowerCase() === email
  );

  let userId = '';

  if (existingAuthUser) {
    console.log(`\nFound existing Auth account for ${email} (ID: ${existingAuthUser.id})`);
    const confirm = await ask('Promote this account to Administrator and update password? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('\nOperation cancelled. No changes were made.');
      rl.close();
      process.exit(0);
    }

    userId = existingAuthUser.id;

    const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: {
        role: 'admin',
      },
      user_metadata: {
        name,
        hall_or_dept: department,
      },
    });

    if (updateAuthErr) {
      console.error(`Failed to update Auth user: ${updateAuthErr.message}`);
      rl.close();
      process.exit(1);
    }
  } else {
    // Ensure email domain is authorized in allowed_email_domains so triggers never block provisioning
    const domainPart = '@' + email.split('@')[1];
    const { data: domCheck } = await supabase.from('allowed_email_domains').select('domain').eq('domain', domainPart);
    if (!domCheck || domCheck.length === 0) {
      await supabase.from('allowed_email_domains').insert({
        domain: domainPart,
        description: 'Authorized university domain'
      });
    }

    console.log('\nCreating new Supabase Auth user...');
    const { data: newAuthData, error: createAuthErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'admin',
      },
      user_metadata: {
        name,
        hall_or_dept: department,
      },
    });

    if (createAuthErr) {
      console.error(`Failed to create Auth user: ${createAuthErr.message}`);
      if (createAuthErr.message?.includes('Database error') || createAuthErr.status === 500) {
        console.error('\n[CampusFix Provisioning Hint]');
        console.error('The database trigger in Supabase rejected this request because handle_new_auth_user()');
        console.error('needs to be updated in your Supabase SQL Editor to allow admin/staff emails.');
        console.error('Please run the SQL migration snippet in your Supabase SQL Editor and try again.\n');
      }
      rl.close();
      process.exit(1);
    }

    userId = newAuthData.user.id;
  }

  // Upsert profile in public.profiles table
  console.log('Configuring public.profiles record with role admin...');
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: userId,
    name,
    email,
    hall_or_dept: department,
    role: 'admin',
    requires_password_change: false,
    is_banned: false,
  });

  if (profileErr) {
    console.error(`Failed to upsert profile: ${profileErr.message}`);
    rl.close();
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('             ADMIN ACCOUNT READY FOR USE              ');
  console.log('======================================================');
  console.log(`  Name:        ${name}`);
  console.log(`  Email:       ${email}`);
  console.log(`  Department:  ${department}`);
  console.log(`  Role:        ADMIN`);
  console.log(`  User ID:     ${userId}`);
  console.log('======================================================\n');

  rl.close();
}

main().catch((err) => {
  console.error('\nUnexpected error during admin creation:', err);
  rl.close();
  process.exit(1);
});
