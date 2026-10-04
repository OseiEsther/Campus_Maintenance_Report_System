# CampusFix: Production Deployment & Infrastructure Guide

This guide provides end-to-end instructions for deploying the **CampusFix** Campus Maintenance Reporting System into production using **Supabase** (Database, Storage, Realtime, and Authentication) and **Render** (or Vercel / Netlify) for static hosting.

---

## 1. Architecture Overview

CampusFix is engineered with a modern, decoupled architecture designed for high availability and zero operational overhead:

- **Frontend Engine**: Next.js 13 App Router compiled as a pre-rendered static export (`output: 'export'` in `next.config.js`). All static assets, HTML pages, and client bundles are generated in the `out/` directory.
- **Backend & Database**: Supabase PostgreSQL database handling relational schema, indexing, foreign keys, and referential integrity.
- **File & Media Storage**: Supabase Storage bucket (`report-photos`) supporting direct client uploads with MIME validation and 10 MB payload limits.
- **Realtime Push Sync**: Supabase Realtime WebSocket engine broadcasting database mutations across client browser tabs.
- **Hosting Tier**: Render Static Site (or Vercel). Runs on a global CDN, is completely free, never enters cold sleep, and has no server spin-up latency.

```
┌──────────────────────────────────────────────────────────┐
│                    User Browser Client                   │
│  (Next.js Single Page App / Persistent React Context)     │
└──────────────┬────────────────────────────┬──────────────┘
               │                            │
               ▼ Direct REST & Realtime     ▼ Direct Photo Uploads
┌───────────────────────────────┐   ┌───────────────────────┐
│     Supabase PostgreSQL       │   │   Supabase Storage    │
│  - profiles / users           │   │  Bucket: report-photos│
│  - reports & status_events    │   │  10 MB size limit     │
│  - corroborations & signals   │   │  Public URL CDN       │
│  - hall_rep_requests & audit  │   └───────────────────────┘
│  - Supabase Realtime Channels │
└───────────────────────────────┘
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

You only need to run **one master script** to completely prepare your Supabase project.

### 1. Create a Supabase Project
1. Log in to [supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **New Project**.
3. Enter your project name (e.g., `campusfix-production`), choose a database password, and select your preferred region.
4. Wait approximately 2 minutes for the database cluster to finish provisioning.

### 2. Run the Master Database Script
1. In your Supabase project dashboard, navigate to the **SQL Editor** from the left navigation menu.
2. Click **New query**.
3. Open [`supabase/schema.sql`](file:///c:/Users/melvi/Desktop/Project/Side/Campus_Maintenance_Report_System/supabase/schema.sql) in your project repository.
4. Copy the entire file content, paste it into the Supabase SQL Editor, and click **Run**.

This script will automatically:
- Create all 10 core tables: `profiles`, `locations`, `reports`, `status_events`, `comments`, `internal_notes`, `verification_signals`, `notifications`, `corroborations`, and `hall_rep_requests`.
- Safely add required columns if updating an existing database.
- Create composite performance indexes on foreign keys and timestamps.
- Configure Row Level Security (RLS) policies allowing public read/write operations for university reporting.
- Create and configure the `report-photos` storage bucket with image MIME restrictions.
- Enable `supabase_realtime` publication across all data tables.
- Send a schema reload notification to the PostgREST API cache.

### 3. (Optional) Populate Seed Data
If you want realistic university demonstration records (sample residence halls, library buildings, demo incident tickets, and initial user accounts):
1. In the Supabase **SQL Editor**, open a new query.
2. Copy the contents of [`supabase/seed.sql`](file:///c:/Users/melvi/Desktop/Project/Side/Campus_Maintenance_Report_System/supabase/seed.sql).
3. Paste and click **Run**.

---

## 4. Step 2: Retrieve API Keys & Configure Environment Variables

1. In your Supabase dashboard, click the **Settings** (gear icon) in the sidebar.
2. Select **API**.
3. Copy the following values:
   - **Project URL**: (e.g., `https://auedssowxperapcdkuaf.supabase.co`)
   - **Project API Keys**: Copy the **`anon` `public`** key.

### Local Development Environment (`.env.local`)
Create a file named `.env.local` in your project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

---

## 5. Step 3: Deploying to Render (Recommended)

Render offers a dedicated **Static Site** service that delivers pre-rendered HTML/JS over a global CDN. It is 100% free forever, never sleeps, and has zero cold starts.

### 1. Push Code to Git
Commit all changes and push your branch to GitHub or GitLab:
```bash
git add .
git commit -m "Prepare production deployment"
git push origin main
```

### 2. Create Static Site on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click the blue **New +** button in the top right and select **Static Site**.
3. Connect your GitHub/GitLab account and select your `Campus_Maintenance_Report_System` repository.

### 3. Configure Build Settings
Fill in the deployment configuration:

| Setting | Recommended Value | Notes |
| :--- | :--- | :--- |
| **Name** | `campusfix` | Your subdomain on `onrender.com` |
| **Branch** | `main` | Production release branch |
| **Root Directory** | *(Leave blank)* | Default root |
| **Build Command** | `npm install && npm run build` | Installs dependencies and generates static files |
| **Publish Directory** | `out` | Points to Next.js static export directory |

### 4. Set Environment Variables on Render
Scroll down to the **Environment Variables** section and add:

| Key | Value | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-id.supabase.co` | Supabase API endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Public client authorization token |
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
4. Click **Deploy**.

---

## 7. Step 5: Post-Deployment Smoke Test Checklist

Once deployed, complete the following verification steps on your production URL:

- [ ] **1. Sign Up & Authentication**:
  - Register an account with an institutional email format (e.g. `student@st.university.edu.gh`).
  - Enter name, select residence/department, and verify immediate entry without redirect loops.
- [ ] **2. Database Synchronization**:
  - Open Supabase Dashboard -> Table Editor -> `profiles`.
  - Confirm the new user profile row exists with `role = 'student'`.
- [ ] **3. Incident Photo Upload**:
  - Go to "New Report", fill out fields, attach an incident image (PNG/JPG), and submit.
  - Confirm the photo displays on the report card and exists in Supabase Storage under `report-photos/reports/...`.
- [ ] **4. Corroboration Engine**:
  - Click "I have seen this too" on another incident.
  - Verify the score increments and the breakdown reads "Confirmed by X people".
- [ ] **5. Role Assignment & Toast Confirmation**:
  - Log in with an Administrator account and navigate to Admin Panel -> User Directory.
  - Change a user role via the Assigned Role dropdown and confirm the success toast appears.
- [ ] **6. URL Route Persistence**:
  - Open any report detail screen (e.g., `?screen=report-detail&id=r1`).
  - Press browser refresh (F5). Confirm the application reloads directly into the report detail screen rather than redirecting to the home screen.

---

## 8. Troubleshooting & Common Pitfalls

### Issue: "Database tables not initialized" Banner
- **Cause**: Supabase connection was successful, but one or more tables (`reports`, `locations`, `profiles`) are missing.
- **Resolution**: Open Supabase SQL Editor and re-run [`supabase/schema.sql`](file:///c:/Users/melvi/Desktop/Project/Side/Campus_Maintenance_Report_System/supabase/schema.sql).

### Issue: Incident Photo Upload Fails
- **Cause**: Storage bucket missing or RLS policy preventing uploads.
- **Resolution**: Verify that the bucket `report-photos` exists under Supabase Storage and is flagged as **Public**. Re-running `supabase/schema.sql` automatically applies the required storage bucket policies.

### Issue: Browser Reload Redirects to Home Page
- **Cause**: Session storage or state lost during client-side hydration.
- **Resolution**: CampusFix uses persistent URL query parameters (`?screen=...&id=...`) synchronized with `localStorage['campusfix_user_id']` to preserve active navigation across hard reloads.

### Issue: Outdated relative timestamps or time skew
- **Cause**: Clock skew between the database and the client browser.
- **Resolution**: `lib/format.ts` incorporates local clock skew buffers (events under 60 seconds return `'just now'`) and normalizes elapsed intervals to midnight local calendar dates.
