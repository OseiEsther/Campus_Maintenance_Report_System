# CampusFix: Campus Maintenance Reporting & Governance System

CampusFix is an enterprise-grade university facilities maintenance reporting, verification, and operations governance platform. It connects students, hall representatives, facilities maintenance personnel, and university administrators in a unified, real-time workflow to track, verify, and resolve campus infrastructure issues.

---

## Architecture & Role Ecosystem

CampusFix provides dedicated workspaces and permission boundaries tailored for each university stakeholder:

- **Student Workspace**:
  - Submit maintenance reports with photos, category tagging, and location selection.
  - Track submitted reports, real-time verification scores, and repair timelines.
  - Corroborate peer reports with one click ("I have seen this too").
  - Apply for official Hall Representative status for their assigned residence.
- **Hall Representative Console**:
  - Dedicated triage queue scoped to the representative's assigned residence hall or academic block.
  - Review and officially verify reports with a +3 verification score boost.
  - File official disputes with structured administrative feedback for invalid or duplicate issues.
- **Facilities Maintenance Crew Console**:
  - Centralized operations board managing tickets through the repair lifecycle (`open` &rarr; `in_progress` &rarr; `resolved`).
  - Dispatch work orders with technician assignment and priority tagging.
  - Maintain threaded internal staff notes visible exclusively to maintenance crew members.
  - Filter and sort by verification score, category, location, or reported age.
- **University Administration Suite**:
  - Executive dashboard with operational KPIs, resolution velocity metrics, and category benchmarks.
  - User Directory with inline role elevation, instant confirmation toasts, and account moderation.
  - Review and decision interface for Hall Representative applications, including formal revocation workflows.
  - Campus infrastructure catalog to add, modify, and archive buildings and facilities.
  - Immutable Audit Trail tracking system events with exact timestamps, user attribution, and ticket links.

---

## Key Features

- **Multi-Tiered Verification Scoring Engine**:
  Combines automated baseline points (+1 submission, +1 photo, +3 detailed description) with human verification signals (peer corroborations by campus community members and official +3 Hall Rep verifications) to prioritize critical repairs.
- **Interactive Campus Blueprint Vector Map**:
  Dynamic SVG architectural map with auto-wrapping sector layouts supporting small and large campuses (scaling comfortably to 20, 30, or more registered facilities). Features radar telemetry pins, category markers, and live issue counts.
- **Inclusive Corroboration Engine**:
  Cross-departmental and cross-faculty corroboration allowing any campus member (students, hall reps, and staff) to validate open issues ("Confirmed by X people").
- **Universal Data Pagination**:
  Built-in pagination across all major views:
  - Campus Incident Feed (10 cards per page)
  - My Reported Incidents (10 cards per page)
  - Hall Rep Queue (6 cards per page)
  - User Directory (10 users per page)
  - Report Moderation (8 reports per page)
  - Audit Trail (10 events per page)
  - Activity Notifications (8 alerts per page)
- **Calendar-Aware Relative Timestamps**:
  Intelligent date calculations distinguishing calendar boundaries (today, yesterday, and elapsed days) with live relative time (`2h ago`, `17h ago`) and full university date/time tooltips on hover.
- **Resilient URL Route & Session Persistence**:
  Direct deep-linking and browser reload protection (`?screen=report-detail&id=r1`) ensuring users never lose their active workspace or report context upon page refresh.
- **Realtime Push Synchronization**:
  Powered by Supabase Realtime WebSocket subscriptions, broadcasting status transitions, comments, and verification updates across browser clients instantly.

---

## Tech Stack

- **Framework**: Next.js 13 (App Router) configured for Static Export (`output: 'export'`)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with dark mode support
- **UI Components**: Radix UI primitives, Lucide React icons
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS)
- **Storage**: Supabase Storage (`report-photos` bucket, 10 MB payload limit)
- **Realtime**: Supabase Realtime WebSocket client
- **Notifications**: Sonner toast notification system

---

## Getting Started

### Prerequisites

- **Node.js**: Version 18.x or 20.x installed
- **Package Manager**: npm (bundled with Node.js), yarn, or pnpm
- **Supabase Project**: Free tier database from [supabase.com](https://supabase.com)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/campus-maintenance-report-system.git
   cd campus-maintenance-report-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file and fill in your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and add:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Initialize the Database**:
   - Open your Supabase Project Dashboard -> **SQL Editor**.
   - Copy the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   - *(Optional)* To populate sample campus data, copy and run [`supabase/seed.sql`](supabase/seed.sql).

5. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Build & Verification

To verify TypeScript types and build the production static export:

```bash
# Run TypeScript type check
npx tsc --noEmit

# Compile production static export (generates out/ folder)
npm run build
```

---

## Production Deployment

CampusFix compiles to static HTML/CSS/JS in the `out/` folder, allowing it to be hosted on **Render Static Sites**, **Vercel**, **Netlify**, or **Cloudflare Pages** with 100% free hosting and zero cold starts.

For step-by-step instructions on setting up Supabase, configuring storage buckets, and deploying to Render or Vercel, refer to the comprehensive deployment guide:

&rarr; **[Read the Deployment Guide (DEPLOYMENT.md)](DEPLOYMENT.md)**

---

## Project Structure

```
├── app/                  # Next.js App Router pages, metadata, and root layout
├── components/
│   ├── screens/          # Role-based workspace views (student, rep, staff, admin)
│   │   ├── admin-panel.tsx       # System admin dashboard, KPIs, user directory
│   │   ├── auth-screen.tsx       # Institutional authentication and passkey entry
│   │   ├── campus-feed.tsx       # Campus-wide incident feed with filters & map
│   │   ├── my-reports.tsx        # Personal report status tracker
│   │   ├── new-report.tsx        # Incident report creation with photo upload
│   │   ├── notifications.tsx     # Activity stream and status alerts
│   │   ├── profile-settings.tsx  # User profile and Hall Rep application
│   │   ├── rep-queue.tsx         # Hall Representative verification console
│   │   ├── report-detail.tsx     # Comprehensive incident view, signals, comments
│   │   └── staff-dashboard.tsx   # Facilities maintenance triage and work orders
│   ├── shared/           # Reusable components (vector map, pagination, badges)
│   └── ui/               # Radix UI primitives and Tailwind form elements
├── lib/
│   ├── data-context.tsx  # Core state management, Supabase sync, and Realtime hooks
│   ├── fixtures.ts       # Fallback mock data and category taxonomy
│   ├── format.ts         # Calendar-aware relative time and ticket token formatters
│   ├── supabase.ts       # Supabase client, storage photo upload, and health check
│   ├── types.ts          # TypeScript domain models, roles, and schema types
│   └── utils.ts          # ClassName merge and utility helpers
├── supabase/
│   ├── schema.sql        # Master database DDL, RLS policies, and storage setup
│   └── seed.sql          # Realistic demonstration seed data
├── DEPLOYMENT.md         # Production deployment instructions
├── README.md             # Project overview and documentation
└── next.config.js        # Next.js static export build configuration
```

---
