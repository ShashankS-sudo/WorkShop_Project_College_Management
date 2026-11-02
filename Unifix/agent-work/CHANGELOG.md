# Unifix Changelog

## [0.5.1] - 2026-10-31 - UI Integration & Styling Fixes
### Fixed
- **Web Portal Styling & Tailwind CSS Pipeline (`apps/web`)**:
  - Configured PostCSS and Tailwind CSS build integration (`tailwind.config.js`, `postcss.config.js`).
  - Added `@tailwind base`, `components`, and `utilities` directives to `theme.css`.
  - Resolved missing layout/flex/grid styles across all management screens.
- **Ticket Detail Modal (`apps/web/src/pages/TicketDetailPage.tsx`)**:
  - Added null guard state to prevent React runtime crash when a ticket fails to load.
- **Queue Dynamic Filters (`apps/web/src/pages/TicketQueuePage.tsx`)**:
  - Added dynamic filter synchronization hook so clicking dashboard metrics dynamically updates the active filter.
- **Campus Fallback State (`apps/web/src/pages/LoginPage.tsx` & `apps/mobile/App.tsx`)**:
  - Preloaded initial campus fixtures to ensure dropdowns and onboarding render cleanly.
  - Added optional chaining safeguards in `AuthContext.tsx`.

## [0.5.0] - 2026-10-31 - Phase 9 & Phase 10 Complete
### Added
- **Mobile Application (`apps/mobile`)**:
  - React Native / Expo application with complete TypeScript compilation.
  - Onboarding with campus selection and simulated OTP authentication.
  - AI-assisted issue description analyzer with similarity duplicate matching.
  - Manual issue reporting form with severity, location, and anonymous toggles.
  - Full Ticket Detail Modal with 21-day stage countdown tracking and elapsed time display.
  - Comments timeline with author details and real-time public comment posting.
  - Reporter reopen workflow allowing the original reporter to reopen a resolved ticket with mandatory reason.
  - In-app notification center with unread badge counter.
  - Entry point `apps/mobile/index.js` registering Expo root component.
- **Comprehensive Multi-Tenant & Security Verification Suite (`services/api/src/integrationVerification.ts`)**:
  - Validates strict 403 Forbidden cross-campus isolation on ticket creation and queries.
  - Validates field-level privacy serialization: third-party ordinary users see sanitized "Anonymous Reporter" with phone and email scrubbed; authorized management sees true reporter details.
  - Validates endorsement deduplication (preventing vote inflation).
  - Validates ticket resolution with mandatory summary (>= 10 chars).
  - Validates reporter-only reopen authorization (blocking unauthorized third parties from reopening tickets).
  - Validates in-app notification center list and read-all operations.
- **Root Scripts**: Added `npm run typecheck`, `npm run test:integration`, and unified `npm test`.
- **Documentation**: Added comprehensive architecture specification in `docs/architecture.md`.

## [0.4.0] - 2026-10-31 - Phase 2 to Phase 6 Complete
### Added
- **Complete Relational Prisma Schema**: 13 models synchronized to Supabase PostgreSQL (Campus, CampusAuthorizedIdentity, Department, Building, Location, Category, User, CampusMembership, RefreshSession, Ticket, TicketAssignment, Comment, Attachment, Endorsement, StatusHistory, PriorityHistory, TicketProgressEvent, EscalationEvent, Notification, AuditLog, AIAnalysis).
- **Development Database Fixtures**: `prisma/seed.ts` seeding 3 campuses (PSTC, MADI, HVU), departments, buildings, locations, categories, pre-authorized identities, manager/tech/student users, and sample tickets.
- **Full Authentication Subsystem**:
  - `POST /api/v1/auth/request-otp` checking `CampusAuthorizedIdentity` registry with development OTP code generation.
  - `POST /api/v1/auth/verify-otp` generating 15-minute JWT access tokens and opaque refresh tokens.
  - `POST /api/v1/auth/refresh` with rotation, cryptographic HMAC-SHA256 hashing in `RefreshSession`, and session reuse mitigation.
  - `POST /api/v1/auth/logout` revoking server-side refresh sessions.
  - `GET /api/v1/auth/me` returning current user and campus memberships.
- **Campus Registry API**:
  - `GET /api/v1/campuses` listing active campuses.
  - `GET /api/v1/campuses/:id` returning departments, buildings, locations, and categories.
  - `POST /api/v1/campuses/:id/check-eligibility` for non-disclosing onboarding verification.
- **Core Ticket System**:
  - `POST /api/v1/tickets` creating tickets with initial status history and optional attachments.
  - `GET /api/v1/tickets` with campus isolation, search, filtering, and role-aware privacy serialization (ordinary users see "Anonymous Reporter"; managers see true identity).
  - `GET /api/v1/tickets/:id` with full detail view and audit trail.
  - `POST /api/v1/tickets/:id/endorse` ensuring 1 unique endorsement per user per ticket.
  - `POST /api/v1/tickets/:id/comments` supporting internal vs public visibility.
  - Management triage endpoints: acknowledge, assign, override priority with reason, resolve with summary, reopen, and mark duplicate.
- **Ticket Lifecycle & 3-Week Escalation Engine**:
  - `TicketProgressEvent` tracking meaningful progress vs generic comments.
  - Background scheduler (`startEscalationScheduler`) running 21-day stage monitoring (and 48h critical timers).
  - Idempotent `EscalationEvent` creation and manager notification alerts.
  - `POST /api/v1/operational/escalation-check` endpoint for manual or cron invocation.
- **In-App Notification Subsystem**:
  - `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`.
- **AI Adapter Subsystem**:
  - `IAIProvider` contract with deterministic `MockAIProvider` and `OpenAICompatibleProvider`.
  - `POST /api/v1/ai/parse` extracting title, category, location, severity, and clarification questions.
  - `POST /api/v1/ai/similarity` detecting potential duplicate tickets within campus boundaries.
  - `GET /api/v1/ai/insights` generating management insights.
- **Comprehensive Integration Suite**: `services/api/src/smokeTest.ts` verifying all 13 core flows against live Supabase PostgreSQL.

### Fixed
- Fixed missing `baseSchema` and duplicate `Campus` type in `packages/shared-schemas`.
- Fixed JWT `SignOptions` overload typing in `authController`.
- Fixed Express route registration order in `app.ts` so API routes are mounted before the 404 handler.
- Fixed symlinks for `node`, `npm`, and `npx` in execution environment.

## [0.2.0] - Phase 1 Complete
### Added
- Shared packages: `packages/shared-types`, `packages/shared-schemas`, `packages/shared-config`.
- Architecture specification and decisions documentation.

## [0.1.0] - Initial Setup
### Added
- Monorepo workspace structure, git repository initialized.
