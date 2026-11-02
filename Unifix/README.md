# Unifix — Centralized Campus Issue Management Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x%20LTS-green.svg)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%2051-black.svg)](https://reactnative.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20&%20Storage-3ECF8E.svg)](https://supabase.com/)

**Unifix** is an enterprise-grade, multi-tenant campus issue-reporting and lifecycle triage platform designed to serve 20–30 distributed educational campuses globally. It bridges ordinary campus reporters (students, faculty, staff, maintenance workers) with authorized campus administrators and global leadership through a unified, high-security backend.

---

## Key Highlights

- **Trusted Backend API Boundary**: The Express API is the sole privileged authority. Mobile and web clients never receive direct database credentials or Supabase service-role keys.
- **Strict Multi-Tenant Isolation**: Campus data boundaries are enforced server-side. Cross-campus requests are strictly blocked with `403 Forbidden`.
- **Role-Aware Anonymous Reporter Privacy**: Ordinary users see sanitized `"Anonymous Reporter"` data. Authorized management can inspect the true reporter's name and contact number for safety interventions.
- **3-Week Stage Escalation Engine**: Tickets remaining in any progress stage for 21 days (or 48 hours for critical safety hazards) trigger automatic, idempotent management escalations and notifications. Stage timers restart only upon meaningful progress events.
- **AI Intelligence with Human Confirmation**: Natural language issue parsing and duplicate suggestion powered by a provider-independent AI adapter (Mock or OpenAI-compatible local GPU endpoints such as Ollama / Qwen). AI output is advisory and never submits or closes tickets automatically.
- **Dual-Token Session Security**: 15-minute JWT access tokens paired with cryptographically random opaque refresh tokens stored as HMAC-SHA256 digests in PostgreSQL, complete with rotation and session reuse attack defense.

---

## Monorepo Architecture

```text
Unifix/
├── apps/
│   ├── mobile/             # React Native (Expo SDK 51) client with APK build profiles
│   └── web/                # React 18 + Vite + Lucide Apple-inspired management portal
├── services/
│   └── api/                # Express + TypeScript backend API with Winston & Helmet
├── packages/
│   ├── shared-types/       # Canonical TypeScript domain interfaces and enums
│   ├── shared-schemas/     # Zod runtime validation schemas
│   └── shared-config/      # Centralized environment configuration and constants
├── prisma/
│   ├── schema.prisma       # 13 relational models on Supabase PostgreSQL
│   └── seed.ts             # Development fixtures (campuses, departments, users, tickets)
├── docs/                   # Architectural, database, security, and deployment guides
│   ├── architecture.md     # Platform architecture & component design
│   ├── database.md         # Database schema, models, constraints, and seed data
│   ├── api.md              # REST API endpoint reference and payload examples
│   ├── security.md         # Multi-tenant isolation & privacy architecture
│   ├── setup.md            # Step-by-step local development & Supabase setup
│   ├── deployment.md       # Production deployment (Docker, Vercel, Cloud GPU)
│   └── android-build.md    # Android Studio, Expo EAS, and APK packaging guide
├── agent-work/             # Persistent recovery state, changelogs, and task tracking
└── package.json            # Monorepo workspaces definition and root scripts
```

---

## Three User Access Layers

### 1. Ordinary Campus Users (Mobile Application)
- **Onboarding & Eligibility**: Select campus, verify student/faculty email or phone via simulated OTP.
- **AI-Assisted & Manual Reporting**: Describe issues in plain text or fill structured fields with optional photo attachments and anonymity toggle.
- **Duplicate Prevention**: AI suggests similar active tickets before submission with an `"I have this issue too"` endorsement button.
- **Stage Progress Tracker**: View real-time 21-day stage countdown timers and historical updates.
- **Reporter Reopening**: Original reporters can reopen resolved tickets if the physical issue persists.

### 2. Campus Management (Web Portal)
- **Campus Dashboard**: Real-time triage metrics, critical hazard attention queue, and overdue 21-day escalation list.
- **Ticket Queue & Triage**: Search, filter, acknowledge, assign departments, record meaningful progress updates, adjust priorities with audit trails, and resolve issues.
- **Reporter Inspection**: Authorized inspection of real reporter identity on anonymous reports.
- **Notification Drawer**: Slide-out in-app alert center for stage expirations and ticket updates.

### 3. Supermanagement (Web Portal)
- **Global Overview**: Multi-campus comparative health matrix across all 20–30 facilities.
- **AI Operational Insights**: Discovers recurring cross-campus problems and overdue department backlogs, strictly distinguishing observed database metrics from AI recommendations.

---

## Quickstart Guide

### 1. Prerequisites
- **Node.js**: v20.x or newer
- **npm**: v10.x or newer
- **Supabase Account**: Free PostgreSQL database and private Storage bucket

### 2. Installation
```bash
git clone <repository-url> Unifix
cd Unifix
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and configure your Supabase connection strings and secrets:
```dotenv
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

JWT_ACCESS_SECRET="unifix-dev-jwt-access-secret-32-chars-min-key"
JWT_REFRESH_SECRET="unifix-dev-jwt-refresh-secret-32-chars-min-key"
REFRESH_TOKEN_PEPPER="unifix-dev-refresh-token-pepper-salt-key"
AI_PROVIDER="mock"
```

### 4. Database Setup & Seed
```bash
npx prisma generate
npx prisma db push
npm run seed
```

### 5. Start Services
```bash
# Terminal 1: Backend API (port 3000)
npm run dev

# Terminal 2: Web Management Portal (port 5173)
cd apps/web && npm run dev

# Terminal 3: Mobile Application (Expo)
cd apps/mobile && npm run start
```

---

## Verification & Testing

Unifix includes comprehensive automated verification suites:

```bash
# Build all workspaces
npm run build

# Typecheck mobile and web
npm run typecheck

# Run end-to-end smoke and multi-tenant security verification
npm test
```

### Verification Checks Performed:
1. Express health and operational readiness check.
2. Campus registry and facility tree querying.
3. Identity eligibility and simulated OTP token issuance.
4. Refresh token rotation and replay attack mitigation.
5. AI natural language parsing and clarification question generation.
6. Ticket creation with stage timer initialization.
7. Strict cross-campus 403 Forbidden tenant isolation.
8. Role-aware anonymous reporter privacy serialization.
9. Composite unique endorsement deduplication.
10. Ticket resolution and reporter-only reopen authorization.

---

## Building the Android APK (Phase 11)

To generate a standalone `.apk` for Android testing:

```bash
cd apps/mobile

# Cloud build (no Android Studio required):
npm run build:apk:cloud

# Local build (requires JDK 17 & Android SDK):
npm run build:apk
```

For detailed instructions on configuring Android Studio, emulator networking (`10.0.2.2`), and physical device testing, see [docs/android-build.md](docs/android-build.md).

---

## Documentation Index

- [System Architecture](docs/architecture.md)
- [Database Schema & Models](docs/database.md)
- [REST API Reference](docs/api.md)
- [Security & Compliance](docs/security.md)
- [Local Development Setup](docs/setup.md)
- [Production Deployment](docs/deployment.md)
- [Android APK Build Guide](docs/android-build.md)
