# Unifix - Setup & Local Development Guide

This guide provides step-by-step instructions to configure, run, and test the **Unifix** platform in local development.

---

## 1. Prerequisites

Ensure the following tools are installed:
- **Node.js**: v20.x or newer (LTS recommended)
- **npm**: v10.x or newer
- **Git**
- *(Optional for Mobile)*: **Expo Go** app on your physical Android device or Android Studio for emulator testing.

---

## 2. Clone & Install Dependencies

1. Clone the repository and enter the directory:
   ```bash
   git clone <repository-url> Unifix
   cd Unifix
   ```
2. Install dependencies across all monorepo workspaces:
   ```bash
   npm install
   ```

---

## 3. Supabase PostgreSQL & Storage Setup

Unifix uses Supabase PostgreSQL for relational data storage and Supabase Storage for private attachments.

### Step 3.1: Create a Supabase Project
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New project** and select an organization.
3. Name your project (e.g., `unifix-campus`) and choose a region close to your primary campus or development location.
4. Set a strong database password and save it securely.

### Step 3.2: Obtain Database Connection Strings
1. In the Supabase Dashboard, navigate to **Project Settings** > **Database**.
2. Scroll to **Connection string** and select the **URI** tab:
   - **Transaction Pooler Connection** (Port `6543`): Used for application runtime with pgBouncer.
     ```text
     postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **Session Pooler / Direct Connection** (Port `5432`): Used for migrations and Prisma direct operations.
     ```text
     postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
     ```

### Step 3.3: Create Private Storage Bucket
1. Navigate to **Storage** in the left sidebar.
2. Click **New bucket**.
3. Name the bucket `attachments`.
4. Ensure **Public bucket** is toggled **OFF** (Unifix enforces signed, private access).

---

## 4. Environment Variables Configuration

Copy the example configuration to `.env`:
```bash
cp .env.example .env
```
Fill in the values in `.env`:
```dotenv
# Database Configuration
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase Keys
SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# JWT Secrets (generate strong 32+ character strings)
JWT_ACCESS_SECRET="unifix-dev-jwt-access-secret-32-chars-min-key"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="unifix-dev-jwt-refresh-secret-32-chars-min-key"
JWT_REFRESH_EXPIRES_IN="7d"
REFRESH_TOKEN_PEPPER="unifix-dev-refresh-token-pepper-salt-key"

# AI Inference Integration
AI_PROVIDER="mock"
AI_ENABLED=true
AI_BASE_URL="http://localhost:11434/v1"
AI_API_KEY=""
AI_MODEL="qwen-2.5-coder"
AI_TIMEOUT_MS=30000
AI_MAX_RETRIES=1

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX=100

# Server
PORT=3000
NODE_ENV="development"
WEB_ORIGIN="http://localhost:5173"
MOBILE_APP_SCHEME="unifix"
```

---

## 5. Database Schema & Development Seed

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```
2. **Push Schema to PostgreSQL**:
   ```bash
   npx prisma db push
   ```
3. **Seed Development Fixtures**:
   ```bash
   npm run seed
   ```
   *This seeds 3 campuses (PSTC, MADI, HVU), departments, buildings, locations, categories, pre-authorized identities, and sample active tickets.*

---

## 6. Running the Applications

### 6.1 Run the Backend API Service
```bash
# Starts Express API on http://localhost:3000
npm run dev
# Or for compiled production mode:
npm run build && npm run start
```
Check health: `curl http://localhost:3000/api/v1/health`

### 6.2 Run the Web Management Portal
```bash
cd apps/web
npm run dev
```
The React 18 management application will open at `http://localhost:5173`.
- **Campus Manager Login**: Select `PSTC`, use `manager.sarah@pstc.test`, OTP code `123456`.
- **Supermanagement Login**: Select `HVU`, use `superadmin.marcus@unifix.test`, OTP code `123456`.

### 6.3 Run the Mobile Reporter Application
```bash
cd apps/mobile
npm run start
```
- Press `a` to open in an Android Emulator.
- Scan the displayed QR code with the Expo Go app on an Android phone connected to the same Wi-Fi.
- **Reporter Login**: Select `PSTC`, use `student.alex@pstc.test`, OTP code `123456`.

---

## 7. Verification & Smoke Checks

Run the automated verification suite to test build integrity and end-to-end security:
```bash
# Compile all workspaces
npm run build

# Typecheck mobile and web
npm run typecheck

# Execute smoke test and multi-tenant security verification
npm test
```
