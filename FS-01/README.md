# SyncSpace — Real-Time Collaborative Workspace

> **One Workspace. Infinite Possibilities.**  
> A high-velocity collaborative workspace platform uniting structured document editing with spatial visual brainstorming and multi-server real-time collaboration.

[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10.1-2d3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Serverless-336791?style=flat&logo=postgresql)](https://neon.tech/)
[![Redis](https://img.shields.io/badge/Redis-7_Pub%2FSub-dc382d?style=flat&logo=redis)](https://redis.io/)
[![Yjs CRDT](https://img.shields.io/badge/Yjs-CRDT_Engine-orange?style=flat)](https://yjs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed?style=flat&logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Technical Documentation](#technical-documentation)
- [Interface Preview](#interface-preview)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Getting Started & Local Setup](#getting-started--local-setup)
- [Environment Variables](#environment-variables)
- [Available Scripts & Testing](#available-scripts--testing)
- [Deployment Architecture](#deployment-architecture)
- [Git Commit Standards](#git-commit-standards)
- [License](#license)

---

## Project Overview

Modern software engineering and product teams face persistent tool sprawl. Architecture flowcharts live in whiteboarding tools, sprint specifications live in document editors, and tasks live in ticket trackers. Context switching across disconnected tools leads to outdated specifications, fragmented feedback, and lost momentum.

**SyncSpace** eliminates tool sprawl by uniting document authoring with spatial visual thinking in a single connected environment:
1. **Structured Document Studio**: Rich-text authoring with headings, checklists, code blocks, callouts, and word counters.
2. **Infinite Spatial Canvas**: Freeform sticky notes with live repositioning, color palettes, and inline editing.
3. **Interactive Sketchboard**: Freehand drawing tools, customizable stroke styles, geometric wireframes, and zoom controls.
4. **Multiplayer CRDT Collaboration**: Sub-50ms peer synchronization, colored collaborator carets, live selections, and online presence avatars.
5. **Contextual Comments & Snapshots**: Threaded document discussions and immutable version history checkpoints with instant rollbacks.
6. **Multi-Server Redis Scaling**: Distributed horizontal scaling with Redis Pub/Sub channels and distributed persistence locks.

---

## Key Features

### 📄 Document Studio
- **Rich-Text Formatting**: Headings (H1, H2, H3), paragraphs, bulleted lists, and blockquotes powered by **TipTap** and **ProseMirror**.
- **Interactive Checklists**: Checkable deliverables with real-time status toggles.
- **Syntax-Highlighted Code Blocks**: Dedicated code snippets for technical specifications.
- **Contextual Callouts**: Highlighted design decisions, notes, and architectural warnings.
- **Metrics**: Live character and word counters.

### 🗺️ Spatial Canvas & Sketchboard
- **Infinite Dot-Grid Surface**: Scalable, pannable spatial board with zoom levels from 50% to 200%.
- **Freehand Pen Drawing**: Smooth HTML5 canvas vector rendering with customizable stroke widths, colors, and clearing.
- **Sticky Notes**: Color-coded notes with draggable positioning, random natural tilts, and inline text editing.
- **View Switcher**: Instant switching between **Dual Canvas** (split screen), **Doc Mode** (full editor), and **Spatial Canvas** (full whiteboard).

### ⚡ Real-Time Collaboration Engine
- **Conflict-Free Replicated Data Types (CRDTs)**: Backed by **Yjs** for deterministic mathematical convergence without write conflicts.
- **Live Colored Cursors**: Figma-style user carats, active text selections, and collaborator role badges.
- **Presence Avatars**: Live indicator of online collaborators in the active room with automated disconnect cleanup.
- **Token Security**: Cryptographic HMAC-SHA256 authentication tokens scoping clients to their specific workspace and page rooms.

### 🏢 Workspace Governance & Permissions
- **Multi-Tenant Workspaces**: Isolated workspaces with customizable branding, member rosters, and activity feeds.
- **Role-Based Access Control (RBAC)**:
  - `OWNER` / `ADMIN`: Full workspace governance, invitation management, and member role assignment.
  - `EDITOR` / `MEMBER`: Full editing rights on documents, canvases, and comments.
  - `VIEWER`: Read-only access; write frames and unauthorized modifications are dropped by the server.

### 💬 Threaded Comments & Version History
- **Document Discussions**: Pinned inline comments with author attribution and timestamps.
- **Snapshot Version History**: Named snapshot checkpoints with one-click safe rollback that creates a new version while preserving complete audit history.

### 🧪 Dedicated Interactive Demo Sandbox
- **Zero-Setup Live Sandbox**: Accessible at `/demo` to test the dual editor, sticky notes, and drawing tools without requiring registration or database access.

---

## Technical Documentation

SyncSpace includes comprehensive internal engineering specifications, database schemas, REST & WebSocket API references, testing verification reports, and deployment runbooks:

| Document | File Path | Focus & Coverage |
| :--- | :--- | :--- |
| **System Architecture** | [`docs/architecture.md`](docs/architecture.md) | Distributed system design, Yjs CRDT flows, WebSocket auth, Redis horizontal scaling, and recovery mechanics |
| **Database Schema** | [`docs/database.md`](docs/database.md) | Complete Prisma 7 models, entity relationships, indexes, constraints, and dual-format persistence strategy |
| **REST & Real-Time API** | [`docs/api.md`](docs/api.md) | All 25 REST endpoints, Better Auth sessions, RBAC permissions, request/response schemas, and WebSocket protocols |
| **Testing & Verification** | [`docs/testing.md`](docs/testing.md) | Automated test execution reports, verification matrices, edge case coverage, and empirical performance benchmarks |
| **Production Deployment** | [`docs/deployment.md`](docs/deployment.md) | Vercel frontend, Railway/Docker WebSocket cluster, Neon PostgreSQL, Upstash Redis, and operational runbook |
| **Project Demo Recording** | [Google Drive Video](https://drive.google.com/file/d/1JNU8kEirZYHpnLJ0bLCUTKMjrdpT46jx/view?usp=sharing) | Video walkthrough demonstrating real-time collaborative editing, spatial canvas, and version history |

---

## Interface Preview

| Workspace Dual View | Dashboard & Projects |
| :---: | :---: |
| ![Dual Canvas Workspace](public/screenshots/workspace-preview.jpg) | ![SyncSpace Dashboard](public/screenshots/dashboard.png) |
| *Split-screen document authoring and spatial visual canvas* | *Production workspace management and project activity* |

| Feature Showcase |
| :---: |
| ![Features Grid](public/screenshots/feature-cards.png) |
| *Four core pillars: Document Studio, Spatial Canvas, Sketchboard, Live Collaboration* |

---

## Technology Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                  │
│  Next.js 16 (App Router) • React 19 • TypeScript 5 • Tailwind CSS v4   │
│  TipTap / ProseMirror • Lucide Icons • Geist Font                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               REST APIs / Cookies  │  WebSockets (y-websocket)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                   │
│  Next.js Route Handlers (/api/*) • Better Auth Engine                  │
│  Node.js WebSocket Collaboration Server (Express + ws)                 │
└──────────────────┬────────────────────────────────┬────────────────────┘
                   │                                │
    Prisma 7 ORM   │                                │  Redis 7 Pub/Sub
                   ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│          DATABASE TIER               │  │       DISTRIBUTED TIER       │
│  Neon Serverless PostgreSQL          │  │  Redis 7 (ioredis)           │
│  Binary Yjs Snapshot Storage         │  │  Pub/Sub & Persistence Locks │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### Detailed Breakdown

| Domain | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16.4.2** & **React 19.3.0** | App Router architecture, Turbopack bundler, server & client components |
| **Language** | **TypeScript 5.x** | Strict end-to-end static typing across schemas, APIs, and UI components |
| **Styling** | **Tailwind CSS v4** | Modern utility-first styling with pure CSS design tokens |
| **Document Engine** | **TipTap 3.32** & **ProseMirror** | Extensible structured rich-text editor with collaborative extensions |
| **Real-Time CRDT** | **Yjs 13.6**, **y-websocket**, **y-protocols** | Mathematical conflict-free replicated data types and awareness |
| **Backend & APIs** | **Node.js**, **Express 5.x**, **ws** | High-throughput WebSocket server cluster and REST endpoints |
| **Database & ORM** | **PostgreSQL** & **Prisma ORM 7.10** | Relational data persistence, foreign keys, migrations, and pooling |
| **Authentication** | **Better Auth 1.7** | Secure HTTP-only cookies, password hashing, and session management |
| **Distributed Scaling** | **Redis 7** & **ioredis 5.11** | Multi-server delta broadcasting and distributed single-writer locks |
| **Validation** | **Zod 4.x** | Strict runtime request and payload validation schemas |
| **Containerization** | **Docker** & **Docker Compose** | Multi-stage production container builds and local stack orchestration |

---

## System Architecture

### Multi-Server Real-Time Synchronization Flow
SyncSpace uses a decoupled, distributed collaboration topology:

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Client A)
    participant Server1 as Collab Server 1 (:1234)
    participant Redis as Redis 7 Pub/Sub
    participant Server2 as Collab Server 2 (:1235)
    actor Bob as Bob (Client B)
    participant DB as Neon PostgreSQL

    Alice->>Server1: Send Yjs binary update (WebSocket)
    Server1->>Server1: Apply update to local Y.Doc
    Server1->>Redis: PUBLISH syncspace:collab:doc:<id> (Update delta)
    Redis-->>Server2: Broadcast update delta
    Server2->>Server2: Apply update to local Y.Doc
    Server2-->>Bob: Forward Yjs update (WebSocket)
    Note over Server1,DB: Debounced Persistence with Distributed Lock
    Server1->>Redis: SET NX PX (Acquire flush lock)
    Server1->>DB: Persist binary snapshot to yjs_documents
    Server1->>Redis: DEL (Release flush lock)
```

1. **Local Client Mutation**: Client applies edit optimistically to local Y.Doc for zero-latency typing.
2. **WebSocket Propagation**: Binary update delta is transmitted to the connected collaboration server.
3. **Cross-Server Redis Pub/Sub**: Update is published across Redis channels to all server instances in the cluster.
4. **Peer Synchronization**: Peer servers apply the update and broadcast it to connected clients.
5. **Single-Writer DB Persistence**: Debounced background persistence flushes compacted snapshots to PostgreSQL using a Redis distributed lock (`SET NX PX`).

---

## Project Structure

```text
syncspace/
├── app/                                # Next.js App Router
│   ├── (auth)/                         # Authentication routes
│   │   ├── login/page.tsx              # Sign-in page
│   │   └── register/page.tsx           # Registration page
│   ├── (dashboard)/                    # Authenticated dashboard
│   │   └── dashboard/page.tsx          # Workspace & activity overview
│   ├── api/                            # REST API route handlers
│   │   ├── auth/[...all]/route.ts      # Better Auth endpoint handlers
│   │   └── workspaces/                 # Workspaces, pages, comments, canvas APIs
│   ├── demo/page.tsx                   # Interactive zero-auth sandbox
│   ├── globals.css                     # Global design tokens & canvas background
│   ├── layout.tsx                      # Root HTML layout & fonts
│   └── page.tsx                        # Public marketing landing page
├── collaboration-server/               # Dedicated WebSocket Server
│   ├── auth.ts                         # Cryptographic token verification
│   ├── persistence.ts                  # PostgreSQL binary snapshot adapter
│   ├── redis.ts                        # Redis Pub/Sub & distributed locking
│   ├── room.ts                         # Yjs room lifecycle & awareness manager
│   ├── server.ts                       # Express HTTP & WebSocket entrypoint
│   └── types.ts                        # Server-side TypeScript interfaces
├── components/                         # React UI Components
│   ├── auth/                           # Authentication forms & logout buttons
│   ├── landing/                        # Landing page sections (Hero, Features, Bento)
│   ├── layout/                         # Top navigation bar & footer
│   ├── sketchboard/                    # Vector whiteboard, toolbars, properties panel
│   ├── ui/                             # Primitive components (Button, Badge, Card, Modal)
│   └── workspace/                      # Document editor, comments, version history
├── prisma/                             # Database Schema & Migrations
│   ├── migrations/                     # Versioned SQL migration scripts
│   └── schema.prisma                   # Prisma 7 schema definitions
├── public/                             # Static assets & screenshots
│   └── screenshots/                    # Application interface previews
├── scripts/                            # Automated E2E test suites
│   ├── test-collaboration.ts           # CRDT & WebSocket sync tests
│   ├── test-presence.ts                # Colored carets & awareness tests
│   ├── test-comments-versions.ts       # Comments & revision rollback tests
│   └── test-multi-server-collab.ts     # Multi-instance Redis coordination tests
├── src/lib/                            # Core Library Modules
│   ├── collaboration/                  # Token signing & color palettes
│   ├── db/prisma.ts                    # PrismaClient with connection retry logic
│   ├── security/rate-limit.ts          # In-memory sliding window rate limiter
│   ├── services/                       # Database business logic services
│   ├── validations/schemas.ts          # Zod validation schemas
│   ├── auth.ts                         # Better Auth server configuration
│   └── dns-fallback.ts                 # Resilient DNS fallback resolver
├── types/                              # Shared TypeScript type definitions
├── docker-compose.yml                  # Full stack Docker orchestration
├── Dockerfile                          # Production multi-stage Docker build
├── package.json                        # Scripts & dependencies
└── tsconfig.json                       # Strict TypeScript configuration
```

---

## Getting Started & Local Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL**: PostgreSQL 15+ (Local Docker or [Neon](https://neon.tech/) cloud database)
- **Redis** *(Optional for multi-server scaling)*: Redis 7+ or [Upstash](https://upstash.com/)

---

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/tejas2504-p/syncspace-collaborative-workspace.git
cd syncspace-collaborative-workspace
npm install
```

---

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your database credentials and authentication secret:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/syncspace?schema=public"
DIRECT_URL="postgresql://username:password@localhost:5432/syncspace?schema=public"
BETTER_AUTH_SECRET="your-32-character-random-secret-key-goes-here"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_COLLAB_WS_URL="ws://localhost:1234"
```

---

### 4. Database Setup & Migrations
Generate the Prisma Client and run migrations:
```bash
npx prisma generate
npx prisma migrate deploy
```

---

### 5. Running the Application
SyncSpace runs two coordinated services for local development:

**Terminal 1 — Next.js Application:**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

**Terminal 2 — Real-Time Collaboration Server:**
```bash
npm run collab:1
```
Listens on `ws://localhost:1234` with health metrics at [http://localhost:1234/health](http://localhost:1234/health).

---

### 6. Running with Docker Compose (Full Stack)
To run the entire stack including Next.js, Collaboration Server, PostgreSQL, and Redis in isolated containers:
```bash
docker compose up --build -d
```
Access the application at [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (pooled connection) |
| `DIRECT_URL` | Optional | — | Unpooled connection string for direct Prisma schema migrations |
| `BETTER_AUTH_SECRET` | **Yes** | — | 32+ character key used to sign session cookies and auth tokens |
| `BETTER_AUTH_URL` | **Yes** | `http://localhost:3000` | Canonical origin URL for Better Auth redirects |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `http://localhost:3000` | Publicly reachable base URL of the web application |
| `NEXT_PUBLIC_COLLAB_WS_URL` | **Yes** | `ws://localhost:1234` | Client-facing WebSocket URL for real-time document rooms |
| `COLLAB_PORT` | Optional | `1234` | Port on which the Node.js collaboration server binds |
| `COLLAB_HOST` | Optional | `0.0.0.0` | Network interface for collaboration server binding |
| `COLLAB_SECRET` | Optional | — | Secret key for signing collaboration room tokens |
| `REDIS_URL` | Optional | `redis://localhost:6379` | Redis URL for multi-server Pub/Sub. If omitted, runs in standalone mode |
| `REDIS_ENABLED` | Optional | `true` | Set to `"false"` to force standalone single-server collaboration |
| `REDIS_KEY_PREFIX` | Optional | `syncspace:collab:` | Key namespace prefix for Redis channels and distributed locks |

---

## Available Scripts & Testing

### Development & Build Commands
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `npm run dev` | Starts local Next.js Turbopack development server |
| `collab:1` | `npm run collab:1` | Starts primary collaboration server on port 1234 |
| `collab:2` | `npm run collab:2` | Starts secondary collaboration server on port 1235 for multi-instance testing |
| `build` | `npm run build` | Generates Prisma client, applies migrations, and runs production build |
| `start` | `npm run start` | Runs the compiled Next.js production server |
| `lint` | `npm run lint` | Runs ESLint 9 checks across the codebase |

### Automated Test Suites
SyncSpace includes an end-to-end automated verification harness:

```bash
# Run real-time CRDT WebSocket synchronization test suite (6/6 passing)
npx tsx scripts/test-collaboration.ts

# Run presence, live cursors, and awareness eviction test suite (7/7 passing)
npx tsx scripts/test-presence.ts

# Run threaded comments and version history rollback test suite (10/10 passing)
npx tsx scripts/test-comments-versions.ts

# Run multi-server Redis coordination test suite (12/12 passing)
npx tsx scripts/test-multi-server-collab.ts

# Run vector sketchboard persistence and real-time collaboration test suite
npm run test:sketchboard:e2e
```

---

## Deployment Architecture

SyncSpace is engineered for a cloud-native, decoupled production deployment:

```text
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│        VERCEL / WEB HOSTING          │     │     RAILWAY / RENDER / FLY.IO        │
│   Next.js 16 App Router (SSR)        │     │   Node.js WebSocket Cluster (ws)     │
│   Better Auth Session Cookies        │     │   Stateful Room Caches & CRDTs       │
└──────────────────┬───────────────────┘     └──────────────────┬───────────────────┘
                   │                                            │
                   │           ┌────────────────────────────────┤
                   │           │                                │
                   ▼           ▼                                ▼
       ┌───────────────────────────────┐            ┌───────────────────────┐
       │     NEON POSTGRESQL (CLOUD)   │            │   UPSTASH REDIS CLOUD │
       │   Relational Models & Snapshots│           │   Pub/Sub Inter-Server│
       └───────────────────────────────┘            └───────────────────────┘
```

1. **Frontend & REST APIs (Vercel)**:
   - Deploy from your GitHub repository to Vercel with framework preset `Next.js`.
   - Set environment variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_COLLAB_WS_URL`).
2. **Collaboration Server (Railway / Render / Fly.io)**:
   - Deploy as a persistent Docker container or Node service running `npm run collab:1`.
   - Set environment variables (`DATABASE_URL`, `REDIS_URL`, `COLLAB_PORT=1234`).
   - Expose WebSocket port `1234` with TLS termination (`wss://`).
3. **Database (Neon Serverless PostgreSQL)**:
   - Use pooled connection string for `DATABASE_URL` and direct connection for `DIRECT_URL`.
4. **Redis Coordination (Upstash / Redis Cloud)**:
   - Set `REDIS_URL="rediss://default:password@host:port"` on your collaboration servers.

---

## Git Commit Standards

This repository follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` Adds a new user-facing capability (e.g. `feat: add collaborative sketchboard`)
- `fix:` Patches a defect or bug (e.g. `fix: resolve document synchronization issue`)
- `docs:` Modifies documentation (e.g. `docs: update system architecture specifications`)
- `style:` Code style, spacing, or UI styling adjustments with no logic changes (e.g. `style: adjust canvas toolbar padding`)
- `refactor:` Code restructuring without changing external behavior (e.g. `refactor: improve workspace components`)
- `test:` Adds or updates automated test suites (e.g. `test: add collaboration integration tests`)
- `chore:` Dependency updates, tooling, or build configuration (e.g. `chore: update Prisma to v7.10`)

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
