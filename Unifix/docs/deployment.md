# Unifix - Production Deployment Guide

This guide details the deployment architecture and procedures for running **Unifix** in a production environment across its backend API, web management portal, mobile client, database, and AI inference server.

---

## 1. Production Architecture Overview

```text
               ┌────────────────────────┐
               │    Cloudflare CDN /    │
               │   SSL Termination /    │
               │      Reverse Proxy     │
               └───────────┬────────────┘
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
┌──────▼──────┐     ┌──────▼──────┐      ┌──────▼──────┐
│  Mobile App │     │   Web App   │      │ Backend API │
│ (Expo/APK)  │     │(SPA/Vercel) │      │(Node/Docker)│
└─────────────┘     └─────────────┘      └──────┬──────┘
                                                │
                      ┌─────────────────────────┼─────────────────────────┐
                      │                         │                         │
               ┌──────▼──────┐           ┌──────▼──────┐           ┌──────▼──────┐
               │  Supabase   │           │  Supabase   │           │  Cloud GPU  │
               │ PostgreSQL  │           │   Storage   │           │(Ollama/vLLM)│
               └─────────────┘           └─────────────┘           └─────────────┘
```

---

## 2. Component Deployment Strategies

| Component | Target Platform | Build Command | Output |
| :--- | :--- | :--- | :--- |
| **Backend API** | Docker / AWS ECS / Render / Railway | `npm run build` | `services/api/dist/server.js` |
| **Web Portal** | Vercel / Netlify / Cloudflare Pages | `npm run build --workspace=apps/web` | `apps/web/dist` |
| **Mobile Client** | EAS Build / Google Play Console | `eas build -p android --profile production` | Standalone `.apk` or `.aab` |
| **Database** | Managed Supabase PostgreSQL | `npx prisma migrate deploy` | Tables & Relational Schema |
| **AI Inference** | Cloud GPU (RunPod / AWS EC2 G5) | `ollama run qwen2.5-coder` | OpenAI-compatible HTTP port |

---

## 3. Backend API Deployment (Docker)

Create a production Dockerfile for the Express API service:

```dockerfile
# Multi-stage production Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/shared-schemas/package*.json ./packages/shared-schemas/
COPY packages/shared-config/package*.json ./packages/shared-config/
COPY services/api/package*.json ./services/api/
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy full source tree
COPY packages ./packages
COPY services/api ./services/api

# Generate Prisma client and compile
RUN npx prisma generate
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/shared-schemas
RUN npm run build --workspace=packages/shared-config
RUN npm run build --workspace=services/api

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-schemas/dist ./packages/shared-schemas/dist
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "services/api/dist/server.js"]
```

---

## 4. Web Management Portal Deployment

The web management portal (`apps/web`) is a standard Vite React single-page application.

1. Build the production bundle:
   ```bash
   cd apps/web
   npm run build
   ```
2. The compiled assets are placed in `apps/web/dist/`.
3. In your hosting platform (Vercel, Netlify, or Cloudflare Pages):
   - **Root directory**: `apps/web`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **SPA Rewrites**: Redirect all routes (`/*`) to `/index.html`.

---

## 5. AI Inference Server (Remote Cloud GPU)

For hosting a local model (such as `Qwen 2.5 Coder`) on an inference GPU instance:

1. Launch a cloud GPU instance with NVIDIA CUDA support (e.g. 1x RTX 4090 or A10G).
2. Install Ollama or vLLM:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ollama pull qwen2.5-coder:7b
   ```
3. Expose the OpenAI-compatible HTTP endpoint securely via reverse proxy or VPN wireguard:
   ```text
   http://gpu-instance.internal:11434/v1
   ```
4. Set in production `.env`:
   ```dotenv
   AI_PROVIDER="openai"
   AI_BASE_URL="http://gpu-instance.internal:11434/v1"
   AI_MODEL="qwen2.5-coder:7b"
   AI_TIMEOUT_MS=30000
   AI_MAX_RETRIES=2
   AI_ENABLED=true
   ```

---

## 6. Production Security Checklist

- [ ] `NODE_ENV` is explicitly set to `production`.
- [ ] Database credentials use Supabase's transaction pooler (`:6543`) with `pgbouncer=true`.
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are generated using cryptographically random 64-character strings (`openssl rand -hex 32`).
- [ ] `REFRESH_TOKEN_PEPPER` is configured and securely stored in environment secrets (never committed).
- [ ] Mobile APK builds contain NO privileged credentials or service-role keys.
- [ ] CORS (`WEB_ORIGIN`) is restricted to the exact production web domain.
- [ ] Automated 3-week stage escalation checks are triggered via scheduled cron or internal worker.
