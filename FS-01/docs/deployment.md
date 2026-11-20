# SyncSpace — Production Deployment Guide

This guide provides step-by-step instructions for deploying **SyncSpace** to production across cloud infrastructure: Next.js frontend on Vercel, serverless PostgreSQL on Neon, the real-time WebSocket collaboration cluster on a persistent container platform (Railway / Render / Fly.io / VPS), and optional Redis 7 distributed coordination on Upstash.

---

## 1. Production Deployment Topology

```mermaid
flowchart TD
    subgraph Edge ["Public Traffic & CDN"]
        DNS["Cloudflare / Domain DNS (SSL/TLS Termination)"]
    end

    subgraph WebTier ["Web Application Tier (Vercel)"]
        NextFrontend["Next.js 16 Web Application"]
        RouteHandlers["Next.js Route Handlers (/api/*)"]
    end

    subgraph CollabTier ["Real-Time Collaboration Tier (Railway / Render / Docker)"]
        WSCollab["Node.js WebSocket Server (Port 1234)"]
        HealthEndpoint["Express Health Probe (/health)"]
    end

    subgraph StorageTier ["Database & Coordination Tier"]
        NeonDB[("Neon Serverless PostgreSQL")]
        UpstashRedis[("Upstash / Managed Redis 7")]
    end

    DNS -->|HTTPS| NextFrontend
    DNS -->|HTTPS| RouteHandlers
    DNS -->|WSS (WebSockets)| WSCollab

    RouteHandlers -->|Pooled Connection| NeonDB
    WSCollab -->|Direct Connection| NeonDB
    WSCollab <-->|TLS Pub/Sub & Mutex| UpstashRedis
```

> [!IMPORTANT]
> **Why WebSockets Require a Dedicated Container Host:**
> Serverless platforms like Vercel have strict HTTP request timeouts (typically 15–60s) and do not support long-lived bidirectional TCP connections. The SyncSpace collaboration server (`collaboration-server/server.ts`) maintains persistent client connections and in-memory Yjs CRDT rooms, requiring deployment on a persistent container platform such as Railway, Render, Fly.io, AWS ECS, or a VPS.

---

## 2. Environment Variables Configuration

The following table lists all environment variables required across services. **Never commit actual production credentials to version control.**

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
| `COLLAB_PORT` | Collab Server | Optional | Port for WebSocket daemon (defaults to `1234` or platform `$PORT`) |
| `COLLAB_HOST` | Collab Server | Optional | Bind host for WebSocket daemon: `0.0.0.0` |
| `REDIS_URL` | Collab Server | Optional | Redis connection URL: `rediss://default:password@redis-host:6379` |
| `REDIS_ENABLED` | Collab Server | Optional | Flag to enable/disable Redis horizontal scaling (`true` / `false`) |
| `REDIS_KEY_PREFIX` | Collab Server | Optional | Prefix for Redis channels and keys: `syncspace:collab:` |

---

## 3. Database Provisioning (Neon PostgreSQL)

1. **Create a Neon Project**:
   - Navigate to the [Neon Console](https://console.neon.tech/) and create a project (e.g. `syncspace-prod`).
   - Copy both the **pooled** connection string and the **direct** connection string.
2. **Configure Connection Pooling**:
   - For **Vercel** (`DATABASE_URL`): Use the pooled connection string (contains `-pooler` in hostname) to handle serverless connection bursts smoothly.
   - For **Collaboration Server & Migrations** (`DIRECT_URL`): Use the direct connection string to ensure long-lived WebSocket transactions and schema migrations run without connection drops.
3. **Run Schema Migrations**:
   Deploy the Prisma schema to production:
   ```bash
   npx prisma migrate deploy
   ```

---

## 4. Frontend & API Deployment (Vercel)

1. **Connect Repository**:
   - Import your GitHub repository into Vercel.
   - Framework Preset: **Next.js**.
2. **Build and Output Settings**:
   - **Build Command**: `prisma generate && prisma migrate deploy && next build`
   - **Install Command**: `npm install`
3. **Configure Environment Variables in Vercel Dashboard**:
   - `DATABASE_URL` (Pooled Neon connection)
   - `DIRECT_URL` (Direct Neon connection)
   - `NEXT_PUBLIC_APP_URL` (`https://your-domain.com`)
   - `BETTER_AUTH_SECRET` (High-entropy random key)
   - `BETTER_AUTH_URL` (`https://your-domain.com`)
   - `NEXT_PUBLIC_COLLAB_WS_URL` (`wss://collab.your-domain.com`)
   - `COLLAB_SECRET` (Same key as on collaboration server)
4. **Deploy**:
   - Trigger deployment. Ensure the build log completes with zero errors.

---

## 5. Collaboration Server Deployment (Railway / Render / Docker)

### 5.1 Docker Container Deployment
Use the included multi-stage `Dockerfile`:
```bash
docker build -t syncspace-collab .
docker run -p 1234:1234 \
  -e DATABASE_URL="postgresql://..." \
  -e COLLAB_SECRET="your-collab-secret" \
  -e COLLAB_PORT=1234 \
  -e COLLAB_HOST=0.0.0.0 \
  syncspace-collab
```

### 5.2 Deploying to Railway
1. Create a new service from your GitHub repository in Railway.
2. Select **Dockerfile** as the build mechanism.
3. Add the required environment variables:
   - `DATABASE_URL` (Direct connection string)
   - `COLLAB_SECRET`
   - `COLLAB_PORT=1234`
   - `COLLAB_HOST=0.0.0.0`
   - `REDIS_URL` (optional, for horizontal scaling)
   - `REDIS_ENABLED=true` (if Redis URL provided)
4. Under Railway service settings, generate a domain (e.g., `syncspace-collab-prod.up.railway.app`).
5. Configure `NEXT_PUBLIC_COLLAB_WS_URL` on Vercel to `wss://syncspace-collab-prod.up.railway.app`.

### 5.3 Health Check Probe
The collaboration server provides an Express health endpoint at `GET /health` (`http://host:1234/health`):
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
    "enabled": false,
    "connected": false
  }
}
```
Configure `/health` as your container platform's HTTP liveness and readiness probe.

---

## 6. Redis Horizontal Coordination Setup (Optional)

When running multiple collaboration server instances behind a load balancer:
1. **Provision Redis**: Provision a managed Redis 7 instance on [Upstash](https://upstash.com/) or cloud provider.
2. **Configure Variables on All Collab Instances**:
   - `REDIS_URL="rediss://default:password@host:port"`
   - `REDIS_ENABLED="true"`
   - `REDIS_KEY_PREFIX="syncspace:collab:"`
3. **Verify Coordination**:
   - Inspect startup logs for `[CollabRedis] Redis coordination adapter connected`.
   - Query `/health` to verify `"redis": { "enabled": true, "connected": true }`.

---

## 7. Domain & CORS Configuration

1. **Custom Domains**:
   - Assign `app.your-domain.com` to Vercel.
   - Assign `collab.your-domain.com` to Railway/Render.
2. **CORS & Trusted Origins**:
   - Ensure `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` match your exact frontend domain without trailing slashes.
   - If using a reverse proxy or Cloudflare, ensure WebSocket upgrade headers are passed:
     - `Upgrade: websocket`
     - `Connection: Upgrade`

---

## 8. Production Troubleshooting Runbook

| Symptom | Probable Cause | Action |
| :--- | :--- | :--- |
| **WebSocket 4401 Unauthorized** | Expired or invalid HMAC token | Check that client fetches token via `/collab-token` immediately before connecting. Ensure `COLLAB_SECRET` matches across Vercel and Collab server. |
| **WebSocket 4403 Forbidden** | User not a member or missing permissions | Ensure user has an active membership record in `workspace_members`. |
| **Viewer cannot edit** | Expected RBAC enforcement | Clients with role `VIEWER` have write privileges blocked by design. Upgrade role to `EDITOR` or `ADMIN`. |
| **Prisma Pool Exhaustion** | Too many serverless connections | Ensure Vercel `DATABASE_URL` uses the Neon connection pooler hostname (`-pooler`). |
| **CORS / Trusted Origin Errors** | Mismatch between browser origin and Better Auth config | Verify `BETTER_AUTH_URL` exactly matches the public domain in the browser address bar. |
| **Redis Failover / Disconnection** | Redis blip or restart | Server automatically falls back to in-memory local room routing until reconnection. Check Redis logs. |
