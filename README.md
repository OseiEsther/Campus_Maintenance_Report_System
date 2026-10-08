# CampusFix: Campus Maintenance Reporting & Operations Governance System

CampusFix is an enterprise-grade university facilities maintenance reporting, verification, and operations governance platform. It connects students, hall representatives, facilities maintenance personnel, and university administrators in a unified, real-time workflow to track, verify, and resolve campus infrastructure issues.

---

## Architecture & Stakeholder Ecosystem

CampusFix provides dedicated workspaces and permission boundaries tailored for each university role:

- **Student Workspace**:
  - Submit maintenance incident reports with photo evidence, category classification, and official campus unit selection.
  - Specify room or exact location within any hall or department.
  - Track submitted reports, real-time verification scores, and repair timelines.
  - Corroborate peer reports with one click ("I have seen this too") for a +2 score increase.
  - Apply for official Hall Representative appointment for their assigned residence hall.
  - Edit and save personal profile details directly to PostgreSQL and Supabase Auth.
- **Hall Representative Console**:
  - Dedicated triage queue scoped strictly to the representative's assigned residence hall.
  - Review and officially verify reports on-site with a +10 verification score boost.
  - File official disputes with structured feedback for invalid or duplicate issues (-5 points).
  - Voluntarily step down from the representative position when term concludes.
- **Facilities Maintenance Crew Console**:
  - Centralized operations board managing tickets through the repair lifecycle (`open` -> `in_progress` -> `resolved`).
  - Dispatch work orders with technician assignment and multi-level priority tagging (`low`, `medium`, `high`, `urgent`).
  - Maintain threaded internal staff notes visible exclusively to maintenance crew members and administrators.
  - Filter and sort by verification score, category, location, priority, or reported age.
- **University Administration Suite**:
  - Executive dashboard with operational KPIs, resolution velocity metrics, and category benchmarks.
  - User Directory with inline role management, account moderation, and suspension capabilities.
  - Securely provision facilities technician accounts directly into Supabase Auth.
  - Review and decision interface for Hall Representative applications, including formal approval and revocation workflows.
  - Campus infrastructure catalog: add, edit, and remove official residence halls, academic departments, and administrative units.
  - Immutable Audit Trail tracking system events with exact timestamps, user attribution, and ticket links.

---

## Campus Units & Unified Locations Registry

Administrators govern the official campus directory via the **Campus Units Registry** in the Admin Panel:
- **Residence Halls** (e.g., Pentagon Hall, Republic Hall, Commonwealth Hall, Continental Hall, Independence Hall)
- **Academic Departments** (e.g., Computer Science & IT, Electrical Engineering, Business School)
- **Administrative Units** (e.g., Central Administration, Library & Archives, Student Affairs & SRC)

When an administrator adds or updates a campus unit:
1. It is stored in `public.campus_units` and synchronized in real time with `public.locations`.
2. The unit immediately becomes available in the report creation form dropdown, grouped cleanly by category.
3. Students can pair the unit with an optional specific room or area (e.g., `Pentagon Hall (Common Bathroom Floor 2)`).
4. The ticket's `hall` field aligns with the Hall Representative's assignment, enabling verification without naming conflicts.

---

## Verification Scoring Engine

The verification score calculates ticket urgency and credibility directly inside PostgreSQL database triggers and security definer functions, preventing client tampering:

| Verification Signal | Point Value | Rules & Constraints |
| :--- | :--- | :--- |
| **Base Submission** | **+1** | Applied automatically on ticket creation |
| **Detailed Description** | **+3** | Awarded when issue description is 100+ characters |
| **Photo Evidence Attached** | **+2** | Awarded when an image evidence file is uploaded |
| **Peer Corroboration** | **+2** | Once per peer student (author excluded) |
| **Hall Rep Confirmation** | **+10** | Once per assigned rep per report (+10 priority boost) |
| **Hall Rep Dispute** | **-5** | Requires 5+ character dispute reason |
| **Score Range** | **0 to 20** | Strictly clamped between 0 (floor) and 20 (ceiling) |

---

## Security & Reliability Architecture

- **Supabase Authentication**:
  - Passwords hashed using industry-standard bcrypt via Supabase Auth.
  - Sessions restored via cryptographic auth tokens (`getSession` / `onAuthStateChange`).
  - Roles enforced server-side via `raw_app_meta_data->>'role'`, preventing client role escalation during sign-up.
- **Strict Row Level Security (RLS)**:
  - Security definer helper functions (`current_role()`, `is_admin()`, `is_staff()`, `is_rep()`, `is_active_user()`).
  - Profiles view (`public_profiles`) protects student email privacy from other students.
  - Append-only audit trail: `status_events` has zero update or delete policies for all callers.
  - Direct modification of `verification_score` by browser clients is blocked by database trigger guards (`guard_report_updates`).
  - Storage bucket `report-photos` restricted to authenticated user folders with 10 MB file caps.
  - `allowed_email_domains` table secured by RLS to administrator modifications only.
- **Sandboxed Domain Protection**:
  - Student registration restricted to `@st.university.edu.gh`.
  - Staff and administration accounts provisioned under `@university.edu.gh`.

---

## Tech Stack

- **Framework**: Next.js 13 (App Router) configured for Static Export (`output: 'export'`)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with dark mode support
- **UI Components**: Radix UI primitives, Lucide React icons
- **Database & Auth**: Supabase Cloud PostgreSQL with Row Level Security (RLS)
- **Storage**: Supabase Storage (`report-photos` bucket, 10 MB payload limit)
- **Realtime**: Supabase Realtime WebSocket client
- **Notifications**: Sonner toast notification system

---

## Getting Started

### Prerequisites

- **Node.js**: Version 18.x or 20.x installed
- **Package Manager**: npm (bundled with Node.js)
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
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN=@st.university.edu.gh
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-for-admin-scripts
   ```

4. **Initialize Database Schema**:
   - Open your Supabase Dashboard -> **SQL Editor**.
   - Copy and execute [`supabase/schema.sql`](supabase/schema.sql).
   - If upgrading an existing database, ensure the trigger update snippet below has been executed so report creation links signals properly.

5. **Seed Demonstration Data & Accounts**:
   ```bash
   npm run seed
   ```
   *Note: The seeder script never overrides existing user passwords or accounts. It populates 10 realistic campus maintenance reports, peer corroborations, comments, and internal notes.*

6. **Run the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Seed Accounts Reference

When you run `npm run seed`, the following demonstration accounts are verified and ready for sign-in:

| Role | Name | Email | Password | Assigned Unit | Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | Dr. Esther Osei Amoako | `oseiesther@university.edu.gh` | `oseiesther` | Central Administration | Platform administration, rep reviews, catalog governance |
| **STAFF** | Daniel Tetteh | `daniel.tetteh@university.edu.gh` | `StaffPass2025!` | Maintenance Unit | Work order assignment, internal notes, ticket resolution |
| **STAFF** | Kojo Mensah | `kojo.mensah@university.edu.gh` | `StaffPass2025!` | Maintenance Unit | Operations tracking, status updates, technician dispatch |
| **REP** | Kwame Appiah | `kwame.rep@st.university.edu.gh` | `RepPass2025!` | Pentagon Hall | Verifies and disputes reports in Pentagon Hall (+10 score) |
| **REP** | Esi Ansah | `esi.ansah@st.university.edu.gh` | `RepPass2025!` | Republic Hall | Verifies and disputes reports in Republic Hall (+10 score) |
| **STUDENT** | Ama Mensah | `ama.mensah@st.university.edu.gh` | `StudentPass2025!` | Pentagon Hall | Reports incidents, uploads photos, corroborates peer issues |
| **STUDENT** | Kwabena Owusu | `kwabena.owusu@st.university.edu.gh` | `StudentPass2025!` | Republic Hall | Reports incidents, corroborates community issues |
| **STUDENT** | Akosua Frimpong | `akosua.frimpong@st.university.edu.gh` | `StudentPass2025!` | Independence Hall | Active student with pending Hall Rep application for review |
| **STUDENT** | Esther Amoako | `oeamoako@st.university.edu.gh` | `oseiamoako` | Computer Science & IT | Reports issues in academic facilities |

---

## Demonstration Maintenance Reports

Running `npm run seed` populates 10 comprehensive demonstration maintenance incident tickets across student residence halls, academic departments, and administrative units:

| Location / Campus Unit | Category | Status | Priority | Details & Stakeholder Workflow |
| :--- | :--- | :--- | :--- | :--- |
| **Pentagon Hall** (Common Bathroom Floor 2) | Plumbing | `open` | `high` | Detailed description, photo evidence, peer student corroborations, verified by Hall Rep (+10) |
| **Republic Hall** (Block A Stairwell) | Electrical | `in_progress` | `urgent` | Sparking ceiling fixture, student corroboration, technician Daniel Tetteh assigned with internal notes |
| **Computer Science & IT** (Lab 204) | Structural | `resolved` | `medium` | Broken window frame repaired and sealed by technician Kojo Mensah, full audit trail |
| **Independence Hall** (Kitchenette Floor 3) | Sanitation | `open` | `medium` | Shared kitchenette drain blockage, peer student corroborations from floor residents |
| **Library & Archives** (2nd Floor Reading Room) | Structural | `in_progress` | `urgent` | Sagging ceiling grid, safety cordon established, work order notes attached |
| **Central Administration** (Visitor Restroom) | Sanitation | `open` | `low` | Dispenser leakage in administrative foyer, standard routine queue |
| **Commonwealth Hall** (Main Quad Walkway) | Other | `resolved` | `medium` | Pathway solar light fixture repaired, resolution audit event logged |
| **Electrical Engineering** (Circuit Lab 1) | Electrical | `open` | `high` | Wall outlet surge suppressor defect, high-priority safety inspection |
| **Continental Hall** (Laundry Room) | Plumbing | `open` | `medium` | Wastewater basin drainage backup, student corroborations recorded |
| **Student Affairs & SRC** (Conference Room) | Other | `in_progress` | `medium` | Air conditioner condensation leak, assigned technician notes recorded |

---

## Provisioning New Administrators

To provision an additional administrator account locally using the service role key:

```bash
npm run create-admin
```

The CLI prompt securely provisions the user in Supabase Auth, updates `public.profiles`, and guarantees the email domain is registered.

---

## Automated Verification & Test Suites

Run the built-in test suites to verify system integrity:

```bash
# 1. Run Verification Scoring Engine Tests (Rule arithmetic and score clamping)
npm run test:scoring

# 2. Run Database Row Level Security Tests (Multi-role policy and permission assertions)
npm run test:rls

# 3. Run TypeScript typecheck
npm run typecheck

# 4. Compile production static export
npm run build
```

---

## Production Deployment

CampusFix compiles to pure static HTML/CSS/JS assets in `out/` and deploys to Render as a Static Site.

Complete step-by-step instructions are available in [DEPLOYMENT.md](DEPLOYMENT.md).
