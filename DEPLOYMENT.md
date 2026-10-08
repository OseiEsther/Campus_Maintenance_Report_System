# CampusFix: Production Deployment & Infrastructure Guide

This guide provides end-to-end instructions for deploying the **CampusFix** Campus Maintenance Reporting System into production using **Supabase** (Database, Storage, Realtime, and Authentication) and **Render** (or Vercel / Netlify) for static hosting.

---

## 1. Architecture Overview

CampusFix is engineered with a decoupled architecture designed for high availability and zero operational overhead:

- **Frontend Engine**: Next.js 13 App Router compiled as a pre-rendered static export (`output: 'export'` in `next.config.js`). All static assets, HTML pages, and client bundles are generated in the `out/` directory.
- **Backend & Database**: Supabase PostgreSQL database handling relational schema, indexing, foreign keys, triggers, and Row Level Security.
- **File & Media Storage**: Supabase Storage bucket (`report-photos`) supporting direct client uploads with MIME validation, user-scoped folder paths, and 10 MB payload limits.
- **Realtime Push Sync**: Supabase Realtime WebSocket engine broadcasting database mutations across client browser tabs.
- **Hosting Tier**: Render Static Site (or Vercel). Runs on a global CDN, is free of charge, never enters cold sleep, and has no server spin-up latency.

```
+----------------------------------------------------------+
|                    User Browser Client                   |
|  (Next.js Single Page App / Persistent React Context)    |
+----------------------------+-----------------------------+
                             |
         +-------------------+-------------------+
         | Direct REST & WebSocket               | Direct Photo Uploads
         v                                       v
+-----------------------------+         +-----------------------+
|     Supabase PostgreSQL     |         |   Supabase Storage    |
|  - profiles / users         |         |  Bucket: report-photos|
|  - reports & status_events  |         |  10 MB size limit     |
|  - corroborations & signals |         |  User folder scoped   |
|  - hall_rep_requests & audit|         +-----------------------+
|  - Supabase Realtime        |
|  - Row Level Security (RLS) |
+-----------------------------+
```

---

## 2. Prerequisites

Before beginning deployment, ensure you have:

1. **Node.js**: Version 18.x or 20.x installed locally.
2. **Git**: Installed and configured.
3. **Supabase Account**: A free account at [supabase.com](https://supabase.com).
4. **Git Repository**: A repository on GitHub or GitLab containing your CampusFix codebase.
5. **Hosting Account**: An account at [render.com](https://render.com) (or [vercel.com](https://vercel.com)).

---

## 3. Step 1: Database & Storage Setup on Supabase

### 1. Create a Supabase Project
1. Log in to [supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **New Project**.
3. Enter your project name (e.g., `campusfix-production`), choose a secure database password, and select your preferred region.
4. Wait approximately 2 minutes for the database cluster to finish provisioning.

### 2. Run the Master Database Script
1. In your Supabase project dashboard, navigate to the **SQL Editor** from the left navigation menu.
2. Click **New query**.
3. Open `supabase/schema.sql` in your project repository.
4. Copy the entire file content, paste it into the Supabase SQL Editor, and click **Run**.

This script will automatically:
- Create all 10 core tables: `profiles`, `locations`, `reports`, `status_events`, `comments`, `internal_notes`, `verification_signals`, `notifications`, `corroborations`, and `hall_rep_requests`.
- Link user profiles directly to `auth.users` with cascading integrity.
- Configure triggers to automatically insert user profiles upon sign up.
- Configure Row Level Security (RLS) policies protecting emails, restricting internal notes, and enforcing role privileges.
- Configure verification scoring engine triggers and trusted PostgreSQL functions (`rep_confirm_report`, `rep_dispute_report`, `admin_update_user_role`, etc.).
- Create and configure the `report-photos` storage bucket with user-scoped folders (`auth.uid()/*`) and image MIME restrictions.
- Enable `supabase_realtime` publication across all data tables.

### 3. (Optional) Populate Campus Seed Data
To populate sample campus facilities and location records:
1. In the Supabase **SQL Editor**, open a new query.
2. Copy the contents of `supabase/seed.sql`.
3. Paste and click **Run**.

---

## 4. Step 2: Configure Environment Variables

1. In your Supabase dashboard, click **Settings** (gear icon) in the sidebar.
2. Select **API**.
3. Retrieve:
   - **Project URL**: (e.g., `https://your-project-id.supabase.co`)
   - **Project API Keys**: Copy the **`anon` `public`** key.

### Local Development Environment (`.env.local`)
Create a file named `.env.local` in your project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN=@st.university.edu.gh
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-for-admin-scripts
```

> Note: Never commit `.env.local` or service role keys to git or repository zips.

---

## 5. Step 3: Deploying to Render (Recommended)

Render offers a dedicated **Static Site** service that delivers pre-rendered HTML/JS over a global CDN. It is free forever, never sleeps, and has zero cold starts.

### 1. Push Code to Git
Commit all changes and push your branch to GitHub or GitLab:
```bash
git add .
git commit -m "Deploy CampusFix production build"
git push origin main
```

### 2. Create Static Site on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click the **New +** button in the top right and select **Static Site**.
3. Connect your repository.

### 3. Configure Build Settings
Fill in the deployment configuration:

| Setting | Recommended Value | Notes |
| :--- | :--- | :--- |
| **Name** | `campusfix` | Your subdomain on `onrender.com` |
| **Branch** | `main` | Production release branch |
| **Root Directory** | *(Leave blank)* | Default root |
| **Build Command** | `npm install && npm run build` | Installs dependencies and generates static export |
| **Publish Directory** | `out` | Points to Next.js static export directory |

### 4. Set Environment Variables on Render
Under the **Environment Variables** section on Render, add:

| Key | Value | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-id.supabase.co` | Supabase API endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Public client authorization token |
| `NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN` | `@st.university.edu.gh` | Allowed student email domain |
| `NODE_VERSION` | `20` | Guarantees modern Node.js build runtime |

### 5. Click "Create Static Site"
Render will initiate the build process. Once complete (typically 60 to 90 seconds), your application will be live at:
`https://campusfix-xxxx.onrender.com`

---

## 6. Step 4: Alternative Deployment (Vercel)

If you prefer deploying to Vercel:

1. Import your repository at [vercel.com/new](https://vercel.com/new).
2. Under **Build and Output Settings**:
   - **Framework Preset**: Next.js
   - **Build Command**: `next build`
   - **Output Directory**: `out`
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN`
4. Click **Deploy**.

---

## 7. Step 5: Post-Deployment Smoke Test Checklist

Once deployed, complete the following verification steps on your production URL:

- [ ] **1. Sign Up & Supabase Auth**:
  - Register an account with an authorized email format (e.g. `student@st.university.edu.gh`).
  - Enter name, select residence hall, enter password, and verify activation.
- [ ] **2. Database Synchronization & Role**:
  - Open Supabase Dashboard -> Table Editor -> `profiles`.
  - Confirm the new user profile row exists with `role = 'student'`.
- [ ] **3. Incident Photo Upload**:
  - Go to "New Report", fill out fields, attach an incident image, and submit.
  - Confirm the photo displays on the report card and exists in Supabase Storage under `report-photos/{userId}/...`.
- [ ] **4. Corroboration Engine**:
  - Click "I have seen this too" on another incident.
  - Verify the score increments by +2 and the breakdown displays the updated count.
- [ ] **5. Role Assignment & Toast Confirmation**:
  - Log in with an Administrator account and navigate to Admin Panel -> User Directory.
  - Change a user role via the Assigned Role dropdown and confirm the success toast appears.
- [ ] **6. URL Route Persistence**:
  - Open any report detail screen (e.g., `?screen=report-detail&id=...`).
  - Press browser refresh (F5). Confirm the application reloads directly into the report detail screen rather than redirecting to the home screen.
- [ ] **7. Automated Test Verification**:
  - Run `npm run test:scoring` to verify verification points arithmetic and clamping.
  - Run `npm run test:rls` to verify Row Level Security policies against unauthorized operations.

---

## 8. Troubleshooting & Common Pitfalls

### Issue: "Database tables not initialized" Banner
- **Cause**: Supabase connection was successful, but one or more tables are missing.
- **Resolution**: Open Supabase SQL Editor and execute `supabase/schema.sql`.

### Issue: Incident Photo Upload Fails
- **Cause**: Storage bucket missing or RLS policy preventing uploads.
- **Resolution**: Re-running `supabase/schema.sql` automatically creates and configures the `report-photos` bucket and sets policies scoped to authenticated user folders.

### Issue: Password or Auth Errors
- **Cause**: User credentials do not match Supabase Auth records.
- **Resolution**: Passwords are encrypted by Supabase Auth. To reset an administrator password, run `npm run create-admin` locally with your service role key.
