# Unifix Architecture Specification

## 1. Overview & Vision
Unifix is a centralized, multi-tenant campus issue-reporting and lifecycle management platform designed to serve 20–30 distributed university and college campuses globally. The platform features three distinct user layers:
1. **Ordinary Campus Users (Students, Faculty, Staff, Technicians)**: Use the mobile React Native (Expo) application to submit facility and safety issues via natural language AI assistance or structured manual forms, track stage progress, endorse existing tickets ("I have this issue too"), and post comments.
2. **Campus Management**: Use the React 18 web dashboard to triage, acknowledge, assign, record meaningful progress updates, adjust priorities with audit trails, and resolve tickets within their assigned campus.
3. **Supermanagement (Organization Leadership)**: Global administrative oversight across all registered campuses, comparative operational health metrics, recurring cross-campus issue detection, and AI maintenance recommendations.

---

## 2. Monorepo Structure

The codebase is organized as a modular TypeScript monorepo with workspace packages:

```text
Unifix/
├── apps/
│   ├── mobile/             # React Native (Expo) reporter application
│   └── web/                # React 18 + Vite + Lucide management & supermanagement portal
├── services/
│   └── api/                # Express + TypeScript backend API
├── packages/
│   ├── shared-types/       # Canonical TypeScript domain contracts & enums
│   ├── shared-schemas/     # Zod validation schemas for requests and payloads
│   └── shared-config/      # Centralized environment configuration and constants
├── prisma/
│   ├── schema.prisma       # 13 relational models on Supabase PostgreSQL
│   └── seed.ts             # Development fixtures (campuses, departments, users, tickets)
├── docs/                   # Architectural, database, security, and deployment guides
├── agent-work/             # Persistent agent recovery state, tasks, and changelogs
├── package.json            # Monorepo workspaces configuration
└── README.md
```

---

## 3. Core Architectural Subsystems

### 3.1 Trusted Backend API Boundary
Mobile and web applications communicate exclusively with the trusted Express backend (`services/api`). Clients never receive direct database credentials or Supabase service-role keys. All operations are subject to:
- Authentication verification (JWT Bearer tokens)
- Role and campus membership authorization (`ensureCampusAccess`)
- Field-level serialization (scrubbing reporter PII on anonymous reports)
- Runtime schema validation using Zod

### 3.2 Authentication & Session Architecture
- **Simulated OTP Engine**: Non-disclosing onboarding flow. Pre-checks eligibility against `CampusAuthorizedIdentity` before issuing a 6-digit verification code.
- **Access Tokens**: Short-lived (15-minute) signed JWTs carrying user ID, email, active campus IDs, and roles.
- **Opaque Refresh Tokens**: Cryptographically random 64-byte hexadecimal strings. The server stores only their HMAC-SHA256 hash in the `RefreshSession` table with expiration, client IP, and User-Agent.
- **Token Rotation & Reuse Attack Mitigation**: On every `/auth/refresh` invocation, the used refresh token is revoked and replaced with a newly issued token. If an already revoked token is presented, all active sessions for that user are immediately purged.

### 3.3 Ticket Lifecycle & 3-Week Escalation Engine
- **Progression Stages**: `REPORTED` → `ACKNOWLEDGED` → `IN_PROGRESS` → `WAITING` → `COMPLETED`.
- **21-Day Stage Window**: The escalation timer begins upon ticket creation. If a ticket remains in any progress stage for 21 days without a meaningful update, the background escalation runner generates an idempotent `EscalationEvent` and notifies campus management.
- **Critical Safety Escalation**: Critical safety issues automatically use an expedited 48-hour stage timer.
- **Meaningful Progress vs Generic Comments**: Formal progress events (`TicketProgressEvent`) explicitly record whether an action restarts the stage timer (e.g. technician dispatched, diagnostic completed). Superficial comments do not reset the timer.
- **Reporter Reopen Workflow**: If an issue is marked resolved but the underlying defect persists, the original reporter can reopen the ticket with a mandatory justification (>= 10 characters), returning the ticket to `OPEN` and restarting the stage timer.

### 3.4 AI Adapter Subsystem (`IAIProvider`)
- Decoupled interface supporting both:
  - `MockAIProvider`: Deterministic keyword heuristic engine for local offline development.
  - `OpenAICompatibleProvider`: Configurable provider connecting to local cloud GPU inference endpoints (e.g. Ollama, vLLM, Qwen).
- **Safety Rule**: AI is an advisory enhancement. AI output is strictly validated with Zod, and tickets are NEVER submitted or merged without explicit user confirmation.
