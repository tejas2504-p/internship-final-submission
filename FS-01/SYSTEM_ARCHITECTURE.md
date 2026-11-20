# SyncSpace — System Architecture & Engineering Specifications

This document outlines the technical architecture, data flows, collaboration protocols, and distributed scaling model of **SyncSpace** — a real-time collaborative workspace combining structured block documentation (Notion-style) with an infinite spatial whiteboard (Figma-style).

---

## 1. High-Level Architecture Overview

SyncSpace employs a decoupled, multi-tier architecture separating high-throughput real-time collaboration compute from stateless application and API logic:

```mermaid
flowchart TD
    subgraph Clients ["Collaborative Clients (Browser)"]
        BrowserA["Client A (Next.js 16 / React 19)"]
        BrowserB["Client B (Next.js 16 / React 19)"]
    end

    subgraph AppTier ["Application Tier (Vercel / Node.js)"]
        NextServer["Next.js App Router (SSR / Dynamic API Routes)"]
        BetterAuth["Better Auth Engine (Session Management)"]
        PrismaClient["Prisma ORM (Connection Pool)"]
    end

    subgraph CollabTier ["Real-Time Collaboration Tier (Node.js Clusters)"]
        Collab1["Collab Server Instance 1 (Port 1234)"]
        Collab2["Collab Server Instance 2 (Port 1235)"]
    end

    subgraph StorageTier ["Data & State Persistence Tier"]
        Postgres[("Neon PostgreSQL Database")]
        RedisCoord[("Redis 7 Pub/Sub & Lock Manager")]
    end

    BrowserA -- "HTTPS / REST API" --> NextServer
    BrowserB -- "HTTPS / REST API" --> NextServer
    NextServer --> BetterAuth
    NextServer --> PrismaClient
    PrismaClient --> Postgres

    BrowserA -- "WSS (Yjs CRDT & Awareness)" --> Collab1
    BrowserB -- "WSS (Yjs CRDT & Awareness)" --> Collab2

    Collab1 <--> RedisCoord
    Collab2 <--> RedisCoord

    Collab1 -- "Compacted Snapshots & JSON" --> Postgres
    Collab2 -- "Compacted Snapshots & JSON" --> Postgres
```

---

## 2. Frontend & Backend Structure

### 2.1 Next.js 16 App Router Structure
The web tier is structured using Next.js 16 (React 19) Server Components, Suspense boundaries, and Route Handlers:

- **Public Routes**:
  - `/` — Interactive landing page showcasing the dual-engine Notion + Figma sandbox.
  - `/login`, `/register` — Authentication interfaces powered by Better Auth.
  - `/invitations/[token]` — Dedicated acceptance portal for workspace member invites.
- **Protected Application Routes (`app/(dashboard)/`)**:
  - `/dashboard` — Multi-workspace dashboard, recent documents, activity summaries.
  - `/workspaces/[workspaceId]` — Workspace view with document lists, member drawer, and activity feed.
  - `/workspaces/[workspaceId]/pages/[pageId]` — Dual-mode rich text document editor with inline comments and version history.
  - `/workspaces/[workspaceId]/canvas` — Infinite collaborative spatial whiteboard.
  - `/workspaces/[workspaceId]/settings` — Granular role management, member invitations, and workspace metadata configuration.
- **REST API Subsystem (`app/api/`)**:
  - Centralized Route Handlers enforcing authentication, RBAC authorization, and input validation.

### 2.2 Client-Side State Management
- **Document Editor**: Tiptap v3 integrated with `@tiptap/extension-collaboration` and `y-prosemirror`. Document changes mutate a shared `Y.XmlFragment` inside an in-memory `Y.Doc`.
- **Spatial Whiteboard**: Custom hook `useCanvas` (`lib/canvas/use-canvas.ts`) orchestrating a `Y.Map<CanvasNode>` synchronized over WebSocket.
- **Awareness Protocol**: Sub-50ms peer cursor positions, tool selections, and user metadata are shared via `y-websocket`'s awareness channel without persisting to the database.

---

## 3. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant API as Next.js API Route
    participant DB as PostgreSQL
    participant Collab as Collab WebSocket Server

    User->>API: 1. Request Collab Token (GET /api/.../collab-token)
    Note over API: Session verified via Better Auth
    API->>DB: 2. Query WorkspaceMember role
    DB-->>API: Returns role (e.g. OWNER, ADMIN, EDITOR, VIEWER)
    API->>API: 3. Sign HMAC-SHA256 Token (60s TTL)
    API-->>User: 4. Return signed token & server WS URL

    User->>Collab: 5. Connect WebSocket: ws://collab-server/?token=...
    Collab->>Collab: 6. Verify HMAC signature & TTL
    Collab->>DB: 7. Verify live workspace membership & role
    DB-->>Collab: Membership active
    Collab-->>User: 8. Connection Accepted (Read-Only or Read-Write)
```

### 3.1 Role-Based Access Control (RBAC) Matrix
Permissions are strictly validated server-side on both HTTP REST endpoints and WebSocket binary channels:

| Action | OWNER | ADMIN | EDITOR | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| View Pages & Canvases | Yes | Yes | Yes | Yes |
| Real-time Awareness (Cursors) | Yes | Yes | Yes | Yes |
| Edit Page Content | Yes | Yes | Yes | No |
| Edit Canvas Objects | Yes | Yes | Yes | No |
| Add / Delete Comments | Yes | Yes | Yes | No |
| Create / Restore Document Versions | Yes | Yes | Yes | No |
| Create Document Pages | Yes | Yes | Yes | No |
| Invite Members (Email) | Yes | Yes | No | No |
| Remove Members / Cancel Invites | Yes | Yes | No | No |
| Change Member Roles | Yes | Yes (Except Owner) | No | No |
| Update Workspace Settings | Yes | Yes | No | No |
| Delete Workspace | Yes | No | No | No |

---

## 4. PostgreSQL & Prisma ORM Integration

Database queries leverage Prisma ORM with connection pooling via `@prisma/adapter-pg` targeting Neon PostgreSQL.

- **Connection Pooling**: Managed via `DATABASE_URL` with pooled connections for stateless Next.js handlers and persistent connections for the collaboration daemon.
- **Relational Integrity**: Foreign keys enforce cascading deletes (`onDelete: Cascade`) so workspace deletion cleanly purges member associations, pages, versions, comments, activities, and canvas nodes.
- **Indexing Strategy**: Composite B-Tree indexes on `(workspaceId, updatedAt DESC)`, `(pageId, createdAt DESC)`, and `(workspaceId, status)` optimize common query filters and prevent full-table scans.

---

## 5. Yjs & WebSocket Collaboration Architecture

SyncSpace isolates real-time CRDT processing into a standalone Node.js WebSocket service (`collaboration-server/server.ts`):

```mermaid
flowchart LR
    subgraph Room ["CollabRoom: workspaceId:pageId"]
        YDoc["In-Memory Y.Doc (CRDT)"]
        Awareness["Yjs Awareness Protocol"]
        Persistence["PostgresPersistenceAdapter"]
    end

    Client1["Client 1 (ws)"] <-->|Yjs Sync Step 1 & 2| Room
    Client2["Client 2 (ws)"] <-->|Yjs Sync Step 1 & 2| Room
    Client3["Client 3 (ws)"] <-->|Awareness Cursor Coordinates| Room

    Room -->|Debounced Compaction Flush| Persistence
    Persistence -->|Binary Snapshot + JSON| PostgreSQL[("PostgreSQL")]
```

### 5.1 Protocol Flow & Message Types
The collaboration server implements the standard Yjs synchronization protocol over binary frames:
1. **Sync Step 1 (Client Handshake)**: Client sends its local `StateVector`.
2. **Sync Step 2 (Server Delta)**: Server computes missing document updates from the vector and replies with the missing CRDT diff.
3. **Sync Step 1 (Server Handshake)**: Server sends its `StateVector`; client returns missing local updates.
4. **Awareness Broadcast**: Ephemeral cursor coordinates, color tags, and user status are broadcast to all connected room peers.
5. **Write Protection**: When a client with role `VIEWER` connects, the server flags the connection as `canEdit: false`. Any incoming document update frame (Message Type 0) from that client is discarded with an error log, preserving read-only integrity.

---

## 6. Redis Distributed Coordination & Scaling

For enterprise scale and multi-server deployments, SyncSpace uses **Redis 7** (`collaboration-server/redis.ts`) to horizontally connect multiple collaboration instances:

```mermaid
flowchart TD
    subgraph Instance1 ["Collab Server Instance 1 (Port 1234)"]
        R1["Room A (Client 1)"]
    end

    subgraph Instance2 ["Collab Server Instance 2 (Port 1235)"]
        R2["Room A (Client 2)"]
    end

    subgraph RedisPubSub ["Redis 7 Cluster / PubSub"]
        ChanUpdates["Channel: syncspace:collab:room:updates"]
        ChanAwareness["Channel: syncspace:collab:room:awareness"]
        DistLock["Distributed Mutex: syncspace:collab:lock:flush"]
    end

    R1 -- "Publish Local CRDT Update" --> ChanUpdates
    ChanUpdates -- "Broadcast Update" --> R2

    R1 -- "Publish Cursor Position" --> ChanAwareness
    ChanAwareness -- "Broadcast Cursor" --> R2

    R1 -.->|"Acquire Lock (SET NX PX)"| DistLock
    R2 -.->|"Acquire Lock (SET NX PX)"| DistLock
```

### 6.1 Redis Key Responsibilities
1. **Pub/Sub CRDT Delta Sync**: When Client 1 on Instance 1 makes an edit, Instance 1 broadcasts the binary update chunk to `syncspace:collab:room:{roomName}:updates`. Instance 2 consumes this message and applies it to its local `Y.Doc`, forwarding the update to Client 2.
2. **Awareness Propagation**: Live cursor coordinates are published across instances via `syncspace:collab:room:{roomName}:awareness`.
3. **Inter-Server Catch-Up**: When a room is created on a new instance, it requests an initial state sync from existing instances over Redis.
4. **Distributed Persistence Mutex**: Prevents race conditions during PostgreSQL writes when multiple servers manage clients in the same room. A distributed lock with a TTL (`SET syncspace:collab:lock:{roomName} <uuid> NX PX 15000`) guarantees only one instance compacts and flushes the document to PostgreSQL at any given time.
5. **Zero-Downtime Standalone Fallback**: If Redis is not configured or fails, the collaboration server automatically reverts to standalone mode with zero downtime for local clients.

---

## 7. Canvas Synchronization & Persistence Flow

To ensure durability, instant cold starts, and searchability, SyncSpace implements a **Dual-Format Persistence Strategy**:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Canvas Client
    participant YMap as Y.Map ("nodes")
    participant Server as Collab Server
    participant DB as PostgreSQL

    UI->>YMap: 1. User drops/edits Sticky Note
    YMap->>Server: 2. Yjs CRDT binary update over WS
    Note over Server: Server applies update to memory Y.Doc
    Server-->>UI: 3. Broadcast update to other room peers
    Note over Server: Mark room dirty & trigger 2s debounce

    Server->>Server: 4. Y.encodeStateAsUpdate(doc) [Compaction]
    Server->>Server: 5. Extract JSON Node AST
    Server->>DB: 6. Upsert Canvas (Binary yjsSnapshot + JSON nodes)
    DB-->>Server: 7. Commit successful
```

### 7.1 CRDT Compaction vs Tombstone Bloat
In raw CRDTs, deleting and moving objects accumulates deletion markers ("tombstones") and fragmented transaction history. SyncSpace solves this during each database flush:
- `Y.encodeStateAsUpdate(doc)` compiles the entire transaction log into a single compacted snapshot.
- Benchmarks demonstrate this reduces snapshot storage overhead by up to **80%**, ensuring fast initial sync times even after thousands of edits.

---

## 8. Deployment Architecture

SyncSpace is designed for cloud-native deployment across managed services:

```mermaid
flowchart TD
    DNS["Cloudflare DNS & DDoS Protection"]
    
    subgraph Vercel ["Vercel Edge & Serverless Platform"]
        WebEdge["Next.js Web Frontend & Route Handlers"]
    end
    
    subgraph ContainerCloud ["Container Platform (Railway / Render / Fly.io)"]
        CollabCluster["Node.js WebSocket Collaboration Server"]
    end

    subgraph DataCloud ["Managed Cloud Storage"]
        NeonDB[("Neon Serverless PostgreSQL")]
        UpstashRedis[("Upstash / Managed Redis 7")]
    end

    DNS -->|HTTPS (Port 443)| WebEdge
    DNS -->|WSS (Port 443 / SSL Terminated)| CollabCluster

    WebEdge -->|Prisma Connection Pool| NeonDB
    CollabCluster -->|Prisma Persistent Client| NeonDB
    CollabCluster <-->|TLS Pub/Sub & Lock| UpstashRedis
```

- **Frontend Hosting**: Vercel handles Next.js App Router SSR, static generation, partial prerendering, and API routes.
- **WebSocket Collab Server**: Containerized Node.js service running on a persistent host (Railway, Render, or VPS) with sticky sessions or Redis-backed multi-server distribution.
- **Database**: Neon Serverless PostgreSQL with autoscaling and instant branching.
- **Coordination**: Upstash Redis or managed Redis cluster for low-latency Pub/Sub delta distribution.

