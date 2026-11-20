# SyncSpace — Production Deployment Guide

This guide covers production deployment for **SyncSpace**, detailing the deployment of the Next.js frontend on Vercel, serverless PostgreSQL on Neon, the real-time WebSocket collaboration cluster on a persistent container platform, and optional Redis distributed coordination.

---

## 1. Architecture Deployment Overview

```mermaid
flowchart TD
    subgraph FrontendPlatform ["Frontend & REST API (Vercel)"]
        NextApp["Next.js 16 Web Application"]
        RouteHandlers["Next.js Route Handlers (/api/*)"]
    end

    subgraph CollabPlatform ["Real-Time Collaboration (Railway / Render / Fly.io)"]
        WSCollab["Node.js WebSocket Server (collaboration-server)"]
    end

    subgraph DataPlatform ["Cloud Storage & Coordination"]
        NeonDB[("Neon Serverless PostgreSQL")]
        UpstashRedis[("Upstash / Managed Redis 7")]
    end

    NextApp --> RouteHandlers
    RouteHandlers -->|Pooled Connection| NeonDB
    WSCollab -->|Direct Connection| NeonDB
    WSCollab <-->|TLS Pub/Sub & Mutex| UpstashRedis
```

> [!IMPORTANT]
> **Why WebSockets Require a Dedicated Container Host:**
> Serverless platforms like Vercel have request timeouts (typically 15–60s) and do not support long-lived duplex TCP connections. The SyncSpace collaboration server (`collaboration-server/server.ts`) maintains persistent client connections and in-memory Yjs CRDT rooms, requiring deployment on a persistent host (such as Railway, Render, Fly.io, AWS ECS, or a VPS).

---

## 2. Environment Variables Configuration

The following table lists all environment variables required by the system. **Never commit actual credentials to version control.**

| Variable | Target Service | Required | Description & Placeholder |
| :--- | :--- | :---: | :--- |
| `DATABASE_URL` | Vercel & Collab | **Yes** | PostgreSQL connection string: `postgresql://user:password@host/database?sslmode=require` |
| `DIRECT_URL` | Vercel (Prisma) | Optional | Direct connection string for Prisma migrations: `postgresql://user:password@direct-host/database?sslmode=require` |
| `NEXT_PUBLIC_APP_URL` | Vercel | **Yes** | Canonical public URL of the web app: `https://syncspace.example.com` |
| `NODE_ENV` | Vercel & Collab | **Yes** | Set to `production` in production environments |
| `BETTER_AUTH_SECRET` | Vercel & Collab | **Yes** | High-entropy 32+ character random string for session tokens: `generate-with-openssl-rand-base64-32` |
| `BETTER_AUTH_URL` | Vercel | **Yes** | Auth base URL: `https://syncspace.example.com` |
| `NEXT_PUBLIC_COLLAB_WS_URL`| Vercel | **Yes** | Public WSS endpoint of collaboration server: `wss://collab.syncspace.example.com` |
| `COLLAB_SECRET` | Vercel & Collab | **Yes** | HMAC secret used to sign short-lived room tokens (defaults to `BETTER_AUTH_SECRET` if identical) |
| `COLLAB_PORT` | Collab Server | Optional | Port for the WebSocket daemon (defaults to `1234` or platform `$PORT`) |
| `COLLAB_HOST` | Collab Server | Optional | Bind host for WebSocket daemon: `0.0.0.0` |
| `REDIS_URL` | Collab Server | Optional | Redis connection URL: `rediss://default:password@redis-host:6379` |
| `REDIS_ENABLED` | Collab Server | Optional | Flag to enable/disable Redis horizontal scaling (`true` / `false`) |
| `REDIS_KEY_PREFIX` | Collab Server | Optional | Prefix for Redis channels and keys: `syncspace:collab:` |

---

## 3. Database Setup (Neon PostgreSQL)

1. **Create a Neon Project**:
   - Navigate to [Neon Console](https://console.neon.tech/) and create a project (e.g., `syncspace-production`).
   - Copy the provided connection string.
2. **Connection Pooling vs. Direct**:
   - For **Vercel** (`DATABASE_URL`): Use the pooled connection string (contains `-pooler` in the hostname) to handle serverless connection bursts.
   - For **Collab Server & Migrations** (`DIRECT_URL`): Use the direct connection string to ensure persistent WebSocket transactions and schema migration locks run cleanly.
3. **Execute Migrations**:
   Run database migrations during build or deployment:
   ```bash
   npx prisma migrate deploy
   ```

---

## 4. Frontend Deployment (Vercel)

1. **Import Repository**:
   - Connect your GitHub repository to Vercel.
   - Framework Preset: **Next.js**.
2. **Configure Build Settings**:
   - **Build Command**: `prisma generate && prisma migrate deploy && next build`
   - **Install Command**: `npm install`
3. **Configure Environment Variables in Vercel**:
   Add the following variables in the Vercel dashboard:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_APP_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`
   - `NEXT_PUBLIC_COLLAB_WS_URL`
   - `COLLAB_SECRET`
4. **Deploy**:
   - Trigger deployment. Verify build logs confirm zero TypeScript errors and successful static/dynamic page generation.

---

## 5. Collaboration Server Deployment (Railway / Render / Fly.io / VPS)

### 5.1 Dockerfile
Use the following production Dockerfile to containerize the collaboration server:

```dockerfile
# Production Dockerfile for SyncSpace Collaboration Server
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json prisma/ ./
RUN npm ci

# Generate Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Copy server source code
COPY collaboration-server ./collaboration-server
COPY src/lib ./src/lib
COPY types ./types
COPY tsconfig.json ./

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/collaboration-server ./collaboration-server
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/types ./types
COPY --from=builder /app/tsconfig.json ./

# Expose HTTP health and WebSocket port
EXPOSE 1234

# Start server using tsx
CMD ["npx", "tsx", "collaboration-server/server.ts"]
```

### 5.2 Deploying to Railway
1. Create a new service from your GitHub repo.
2. Set the root directory or configure Railway to build using the Dockerfile.
3. Configure environment variables:
   - `DATABASE_URL`
   - `COLLAB_SECRET`
   - `REDIS_URL` (if horizontal multi-instance scaling is enabled)
   - `REDIS_ENABLED=true`
4. Railway will automatically expose the service over HTTPS/WSS with SSL termination.
5. Point `NEXT_PUBLIC_COLLAB_WS_URL` on Vercel to `wss://<your-railway-domain>`.

### 5.3 Health Check & Monitoring
The collaboration server provides an HTTP health endpoint at `/health` (`http://localhost:1234/health`):
```json
{
  "status": "ok",
  "service": "SyncSpace Collaboration Server",
  "version": "Phase 7B (Multi-Server Distributed Collaboration)",
  "port": 1234,
  "host": "0.0.0.0",
  "activeRooms": 3,
  "dirtyRooms": 0,
  "uptime": 1420.5,
  "redis": {
    "enabled": true,
    "connected": true
  }
}
```
Use `/health` as the container platform liveness and readiness probe.

---

## 6. Redis Coordination Setup (Optional Horizontal Scaling)

If running multiple collaboration server instances behind a load balancer:
1. **Provision Redis**: Provision a Redis 7 instance on [Upstash](https://upstash.com/) or managed cloud provider.
2. **Set Environment Variables**:
   - `REDIS_URL="rediss://default:password@host:port"`
   - `REDIS_ENABLED="true"`
   - `REDIS_KEY_PREFIX="syncspace:collab:"`
3. **Verify Connection**:
   - On server startup, check logs for `[CollabRedis] Redis coordination adapter connected`.
   - Access `/health` to verify `"redis": { "enabled": true, "connected": true }`.

---

## 7. Production Troubleshooting & Verification

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **WebSocket 4401 Unauthorized** | Token missing or expired (TTL: 60s) | Verify client fetches token via `/collab-token` immediately prior to WebSocket handshake. |
| **WebSocket 4403 Forbidden** | User not a member or token scope mismatch | Ensure user is an active member of the workspace in the database. |
| **Viewer cannot edit** | Expected RBAC enforcement | Users with `VIEWER` role have write privileges blocked by design. Upgrade role to `EDITOR` or `ADMIN`. |
| **Prisma Pool Exhaustion** | Too many concurrent serverless connections | Ensure `DATABASE_URL` on Vercel points to the Neon connection pooler endpoint (`-pooler`). |
| **CORS / Trusted Origin Errors** | Origin domain not matching `BETTER_AUTH_URL` | Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the exact production domain (no trailing slashes). |
| **Redis Failover / Disconnection** | Redis instance reboot or network blip | The adapter logs warnings and automatically falls back to local in-memory room routing until reconnection. |

