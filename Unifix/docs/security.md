# Unifix - Security & Compliance Architecture

This document defines the security architecture, threat model, tenant boundaries, and access control policies for **Unifix**.

---

## 1. Security Architecture & Threat Model

Unifix is a multi-tenant platform serving 20–30 distributed educational campuses. Its security architecture is built on the **Trusted Backend Boundary** pattern:
- The backend (`services/api`) is the sole trusted entity with database access.
- Clients (Mobile app and Web dashboard) are treated as untrusted and never receive direct database connection strings, Supabase service-role credentials, or private AI inference API keys.

---

## 2. Authentication & Session Security

### 2.1 Non-Disclosing Eligibility & Simulated OTP
- **Pre-Registration Check**: The onboarding endpoint (`POST /campuses/:id/check-eligibility`) checks the `CampusAuthorizedIdentity` registry to determine if an identifier is whitelisted for that campus before initiating verification.
- **Simulated OTP Delivery**: Generates a cryptographically random or configured 6-digit verification code with a 5-minute time-to-live (`expiresInSeconds: 300`).
- **Rate Limiting**: Brute-force verification attempts are throttled to 5 requests per IP / identifier per hour.

### 2.2 Dual-Token Session Architecture
- **Short-Lived Access Tokens**:
  - Format: Signed JSON Web Tokens (JWT) using `HS256`.
  - Expiration: 15 minutes (`JWT_ACCESS_EXPIRES_IN="15m"`).
  - Claims: `userId`, `email`, `activeCampuses`, `roles`.
- **Opaque Refresh Tokens with Server-Side Hashing**:
  - Format: Cryptographically random 64-byte hexadecimal strings.
  - Storage: Plaintext tokens are **never** persisted to the database. Only their `HMAC-SHA256` digest (keyed with `REFRESH_TOKEN_PEPPER`) is stored in the `RefreshSession` PostgreSQL table.
  - Session Metadata: Tracks client IP, User-Agent, creation time, expiration date, and revocation state.

### 2.3 Token Rotation & Session Reuse Attack Defense
- On every `/auth/refresh` invocation, the presented refresh token is immediately invalidated (`isRevoked: true`), and a new pair of access and refresh tokens is issued.
- **Replay Detection**: If a client presents an already revoked refresh token (indicating that the token was intercepted by an attacker), the server immediately executes an emergency purge, revoking **all active refresh sessions** for that user account.

---

## 3. Strict Multi-Tenant Campus Isolation

### 3.1 Server-Side Enforcement
Tenant isolation is enforced in Express middleware (`ensureCampusAccess`) and in Prisma database queries:
```typescript
// All queries explicitly scoped to user's permitted campus
const ticket = await prisma.ticket.findFirst({
  where: {
    id: ticketId,
    campusId: req.user.activeCampusId, // Enforced at DB level
  },
});
```

### 3.2 Cross-Campus Boundary Defense
- A campus user from Campus A attempting to read, update, comment on, or endorse a ticket belonging to Campus B is rejected with `403 Forbidden`.
- Campus Managers can only triage tickets belonging to their assigned campus.
- Only users with the explicit `SUPERMANAGEMENT` system role can access cross-campus aggregates.

---

## 4. Field-Level Anonymous Reporter Privacy

Per Section 18 of the Master Specification, Unifix implements fine-grained, role-aware field serialization:

### 4.1 Policy Rules
1. **Ordinary Campus Users**: When viewing an anonymous ticket (`isAnonymous: true`), the reporter's true name, email address, phone number, and avatar are scrubbed at the API layer before serialization:
   ```json
   {
     "reporter": {
       "id": null,
       "name": "Anonymous Reporter",
       "email": null,
       "phone": null
     }
   }
   ```
2. **Campus Management & Supermanagement**: Authorized administrators **are granted access** to view the true reporter's name, email, and phone number, even for anonymous reports, to enable safety interventions and incident follow-ups.

### 4.2 Implementation
Field serialization is performed server-side in `services/api/src/controllers/ticketController.ts` via `serializeTicket()`. It is never handled via client-side CSS or UI hiding.

---

## 5. Input Validation & API Protection

1. **Zod Runtime Schema Validation**: All request bodies, query parameters, and URL route parameters are validated using strict Zod schemas (`packages/shared-schemas`). Unexpected or malformed properties are rejected with `400 Bad Request`.
2. **HTTP Security Headers**: Express uses `helmet` to set security headers including `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Strict-Transport-Security`.
3. **CORS Restrictions**: API allows cross-origin requests exclusively from whitelisted origins configured in `WEB_ORIGIN`.
4. **Endorsement Deduplication**: Endorsement operations enforce a composite unique index (`@@unique([ticketId, userId])`). Repeated endorsement attempts from the same user are rejected with `409 Conflict`.
5. **Reporter-Only Reopen Authorization**: If an issue is marked resolved, only the original reporter or authorized campus managers can reopen the ticket. Third-party reopen attempts are rejected with `403 Forbidden`.

---

## 6. Private File Attachments & Supabase Storage

- **Private Storage Bucket**: Ticket attachments are stored in a private Supabase Storage bucket (`attachments`). Public read access is disabled.
- **Access Authorization**: The Express API verifies that the caller has access to the associated ticket before generating short-lived signed URLs for upload or download.
- **File Validation**: Attachments are checked for maximum file size (10MB) and allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
