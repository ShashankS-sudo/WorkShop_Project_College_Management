# Unifix - REST API Reference

The Unifix API is a versioned, secure REST API mounted at `/api/v1`. All requests and responses use JSON format.

---

## 1. General Conventions

### Base URL
```text
http://localhost:3000/api/v1
```

### Authentication Header
Protected endpoints require an `Authorization` header containing a valid Bearer JWT access token:
```http
Authorization: Bearer <access_token>
```

### Standard Response Envelope
```json
{
  "data": { ... },
  "message": "Optional human-readable confirmation"
}
```

### Standard Error Envelope
```json
{
  "error": "Error description or code",
  "message": "Human-readable explanation",
  "details": [ ... ]
}
```

---

## 2. Authentication Endpoints

### 2.1 Request OTP (Simulated Provider)
Checks eligibility against the `CampusAuthorizedIdentity` registry and generates a development 6-digit verification code.

- **Route**: `POST /api/v1/auth/request-otp`
- **Body**:
  ```json
  {
    "campusId": "3fb3dd4e-e8cf-408b-9fea-d8401be28576",
    "identifier": "student.alex@pstc.test",
    "isAnonymous": false
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "message": "Verification code generated (development simulated delivery)",
    "identifier": "student.alex@pstc.test",
    "campusId": "3fb3dd4e-e8cf-408b-9fea-d8401be28576",
    "expiresInSeconds": 300,
    "developmentOtpCode": "123456"
  }
  ```

---

### 2.2 Verify OTP & Issue Tokens
Validates the 6-digit OTP code, provisions or retrieves the User and CampusMembership, and issues a 15-minute access token and an opaque refresh token.

- **Route**: `POST /api/v1/auth/verify-otp`
- **Body**:
  ```json
  {
    "campusId": "3fb3dd4e-e8cf-408b-9fea-d8401be28576",
    "identifier": "student.alex@pstc.test",
    "code": "123456",
    "isAnonymous": false
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "69739eb031a2b05d8183e771f1e1...",
    "expiresIn": 900,
    "user": {
      "id": "0c999c9c-46f2-4f3b-87d1-07c1ad683ab1",
      "email": "student.alex@pstc.test",
      "firstName": "Alex",
      "lastName": "Mercer"
    }
  }
  ```

---

### 2.3 Rotate Refresh Token
Exchanges an active opaque refresh token for a new access token and a rotated refresh token. Revokes the old session. Mitigates token reuse attacks.

- **Route**: `POST /api/v1/auth/refresh`
- **Body**:
  ```json
  {
    "refreshToken": "69739eb031a2b05d8183e771f1e1..."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "e44d57c...",
    "expiresIn": 900
  }
  ```

---

### 2.4 User Profile & Permitted Campuses
Returns the currently authenticated user identity and active campus memberships.

- **Route**: `GET /api/v1/auth/me`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response** (`200 OK`):
  ```json
  {
    "data": {
      "id": "0c999c9c-46f2-4f3b-87d1-07c1ad683ab1",
      "email": "student.alex@pstc.test",
      "firstName": "Alex",
      "lastName": "Mercer",
      "campuses": [
        {
          "id": "3fb3dd4e-e8cf-408b-9fea-d8401be28576",
          "name": "Pacific Science & Tech Campus",
          "code": "PSTC",
          "role": "REPORTER"
        }
      ]
    }
  }
  ```

---

## 3. Campus Registry Endpoints

- **`GET /api/v1/campuses`**: Lists active campuses (id, name, code, timezone). Public or authenticated.
- **`GET /api/v1/campuses/:id`**: Returns full campus details, facilities, departments, buildings, locations, and active categories.
- **`POST /api/v1/campuses/:id/check-eligibility`**: Non-disclosing pre-check verifying if an email/phone exists in `CampusAuthorizedIdentity` before requesting an OTP.

---

## 4. Core Ticket Endpoints

### 4.1 Create Ticket
Creates a new campus issue report.

- **Route**: `POST /api/v1/tickets`
- **Headers**: `Authorization: Bearer <access_token>`
- **Body**:
  ```json
  {
    "campusId": "3fb3dd4e-e8cf-408b-9fea-d8401be28576",
    "title": "Water fountain leaking in Turing Hall 1st floor",
    "description": "The water fountain has low pressure and water is spilling onto the corridor floor.",
    "categoryId": "optional-uuid",
    "locationId": "optional-uuid",
    "severity": "MODERATE",
    "impact": "GROUP",
    "urgency": "NORMAL",
    "isAnonymous": false
  }
  ```
- **Response** (`201 Created`): Returns created ticket with initial status `OPEN` and stage clock initiated.

---

### 4.2 List Campus Tickets (Role-Aware Privacy Serialization)
Lists tickets for the user's active campus with search, filtering, and pagination.

- **Route**: `GET /api/v1/tickets?campusId=...&status=OPEN&search=fountain`
- **Field-Level Privacy Serialization**:
  - When a ticket has `isAnonymous: true`:
    - **Ordinary Campus Users** receive:
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
    - **Authorized Campus Managers** (`MANAGEMENT`, `SUPERMANAGEMENT`) receive the real reporter identity:
      ```json
      {
        "reporter": {
          "id": "0c999c9c...",
          "name": "Alex Mercer",
          "email": "student.alex@pstc.test",
          "phone": "+15550100001"
        }
      }
      ```

---

### 4.3 Endorse Ticket ("I have this issue too")
Records an affected-user endorsement. Enforces uniqueness per user-ticket pair (rejects duplicate attempts with `409 Conflict`).

- **Route**: `POST /api/v1/tickets/:id/endorse`
- **Response** (`200 OK`):
  ```json
  {
    "message": "Endorsement recorded",
    "ticketId": "b2e901a4...",
    "totalEndorsements": 1
  }
  ```

---

### 4.4 Submit Comment
Posts public or internal comments.

- **Route**: `POST /api/v1/tickets/:id/comments`
- **Body**:
  ```json
  {
    "content": "A cone has been placed near the leak.",
    "isInternal": false
  }
  ```

---

## 5. Management Triage & Lifecycle Endpoints

Requires `MANAGEMENT` or `SUPERMANAGEMENT` role.

- **Acknowledge Ticket**: `POST /api/v1/tickets/:id/acknowledge` — Sets status to `ACKNOWLEDGED` and restarts the 21-day stage timer.
- **Assign Ticket**: `POST /api/v1/tickets/:id/assign` — Assigns responsible department or technician.
- **Record Meaningful Progress**: `POST /api/v1/tickets/:id/progress` — Records formal progress updates (`TicketProgressEvent`) with `resetsStageTimer: true`.
- **Override Priority**: `POST /api/v1/tickets/:id/priority` — Sets official management priority with a mandatory audit reason.
- **Resolve Ticket**: `POST /api/v1/tickets/:id/resolve` — Sets status to `RESOLVED` with a mandatory summary (>= 10 characters). Removes ticket from active triage queue while preserving historical records.
- **Reopen Ticket**: `POST /api/v1/tickets/:id/reopen` — Allowed by original reporter or management with mandatory reason. Restarts stage timer to `REPORTED`.
- **Mark Duplicate**: `POST /api/v1/tickets/:id/duplicate` — Marks ticket as a duplicate of a canonical ticket ID with reason.

---

## 6. AI Intelligence Endpoints

- **`POST /api/v1/ai/parse`**: Takes natural language description, extracts suggested title, category, location, severity, and generates missing-information clarification questions.
- **`POST /api/v1/ai/similarity`**: Scans active tickets within the caller's campus to detect similar issues and suggest endorsements before submission.
- **`GET /api/v1/ai/insights`**: Generates management insights for supermanagement, strictly distinguishing observed database metrics from AI recommendations.

---

## 7. Escalation & Notifications

- **`POST /api/v1/operational/escalation-check`**: Background runner or cron endpoint that scans tickets in active stages exceeding 21 days (or 48 hours for critical issues) and idempotently generates escalation events and notifications.
- **`GET /api/v1/notifications`**: Lists caller notifications.
- **`PATCH /api/v1/notifications/:id/read`**: Marks a single notification read.
- **`POST /api/v1/notifications/read-all`**: Marks all notifications read.
