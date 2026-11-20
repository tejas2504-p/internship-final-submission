# SyncSpace — System Architecture & Engineering Specifications

This document provides a comprehensive technical breakdown of **SyncSpace**, a distributed, real-time collaborative workspace that integrates structured block document authoring (Notion-style), an infinite spatial whiteboard (Figma-style), and a freehand vector sketchboard into a single unified platform.

---

## 1. High-Level System Architecture

SyncSpace employs a decoupled, multi-tier architecture separating high-throughput real-time collaboration compute from stateless application and API logic:

```mermaid
flowchart TD
    subgraph Clients ["Collaborative Clients (Web Browsers)"]
        BrowserA["Client A (Next.js 16 / React 19)"]
        BrowserB["Client B (Next.js 16 / React 19)"]
    end

    subgraph AppTier ["Application Tier (Vercel / Node.js)"]
        NextServer["Next.js App Router (SSR & Route Handlers)"]
        BetterAuth["Better Auth Engine (Session Management)"]
        PrismaClient["Prisma ORM 7 (Database Access)"]
        TokenService["Collab Token Signer (HMAC-SHA256)"]
    end

    subgraph CollabTier ["Real-Time Collaboration Tier (Node.js Clusters)"]
        Collab1["Collab Server Instance 1 (Port 1234)"]
        Collab2["Collab Server Instance 2 (Port 1235)"]
        ExpressHealth["HTTP Health Probe (/health)"]
    end

    subgraph StorageTier ["Data Persistence & Coordination Tier"]
        Postgres[("Neon Serverless PostgreSQL")]
        RedisCoord[("Redis 7 Pub/Sub & Mutex Manager")]
    end

    BrowserA -- "HTTPS / REST API" --> NextServer
    BrowserB -- "HTTPS / REST API" --> NextServer
    NextServer --> BetterAuth
    NextServer --> TokenService
    NextServer --> PrismaClient
    PrismaClient --> Postgres

    BrowserA -- "WSS (Yjs CRDT & Awareness)" --> Collab1
    BrowserB -- "WSS (Yjs CRDT & Awareness)" --> Collab2

    Collab1 <-->|"Pub/Sub CRDT Updates & Awareness"| RedisCoord
    Collab2 <-->|"Pub/Sub CRDT Updates & Awareness"| RedisCoord

    Collab1 -- "Compacted Yjs Snapshot & JSON AST" --> Postgres
    Collab2 -- "Compacted Yjs Snapshot & JSON AST" --> Postgres
```

---

## 2. Core Architectural Components

### 2.1 User / Browser Client
- **Framework**: Next.js 16 (App Router) with React 19 concurrent features and Server Components.
- **Document Editor**: Tiptap v3 built on ProseMirror, coupled with `@tiptap/extension-collaboration` and `y-prosemirror`. Document changes mutate a shared `Y.XmlFragment` inside an in-memory `Y.Doc`.
- **Spatial Canvas**: Custom high-performance canvas engine (`lib/canvas/use-canvas.ts`) orchestrating a shared `Y.Map<CanvasNode>`. Supports shapes, sticky notes, orthogonal connectors, and cards with pan/zoom viewport transforms.
- **Sketchboard**: Vector drawing engine (`lib/sketchboard/use-sketchboard.ts`) supporting freehand pressure-sensitive strokes, smooth quadratic Bézier curve interpolation, sticky notes, and wireframing tools over a shared `Y.Map<SketchElement>`.
- **Real-Time Presence**: Cursor coordinates, user avatars, active selection IDs, and assigned colors stream via the `y-protocols/awareness` protocol over WebSockets with sub-50ms latency.

### 2.2 Next.js Web & API Tier
- **Routing**: Next.js App Router with React Server Components (RSC) for zero-bundle initial page loads and fast server-side rendering.
- **REST API Routes (`app/api/`)**: Centralized route handlers handling workspace CRUD, member management, invitation tokens, comments, version snapshots, and room token issuance.
- **Authentication**: Managed via **Better Auth** with HTTP-only secure cookie sessions, password hashing, and user account verification.
- **Collaboration Token Signer**: Issues cryptographically signed HMAC-SHA256 tokens (`src/lib/collaboration/tokens.ts`) with a short 60-second time-to-live (TTL). Every client must present a valid token to connect to the WebSocket collaboration daemon.

### 2.3 Standalone Collaboration WebSocket Server
- **Service**: Standalone Node.js process (`collaboration-server/server.ts`) listening on port 1234.
- **Protocol**: Duplex WebSockets implementing the Yjs binary sync protocol (Sync Steps 1 & 2) and Awareness protocol.
- **Role Enforcement**: Parses signed connection tokens, performs database role verification (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`), and enforces write protection. Connections from `VIEWER` clients have incoming CRDT edit frames dropped at the socket layer.
- **Persistence Daemon**: In-memory rooms are debounced (2-second quiet period) and flushed to PostgreSQL through `collaboration-server/persistence.ts`.
- **Health & Monitoring**: Exposes an Express HTTP endpoint at `GET /health` reporting memory usage, uptime, active rooms, dirty room count, and Redis connection status.

### 2.4 Persistence & Distributed Coordination Tier
- **PostgreSQL Database**: Neon serverless PostgreSQL managed via Prisma ORM 7 (`@prisma/adapter-pg`). Houses user accounts, workspaces, permissions, comments, revision history, and canvas states.
- **Dual-Format Storage**: Canvas and Sketchboard models store both a raw binary `yjsSnapshot` (for zero-loss CRDT rehydration) and a structured JSON AST (for fast SSR, search, and REST reads without spinning up a Yjs runtime).
- **Redis 7 Coordination**: When multiple collaboration server instances are deployed, Redis Pub/Sub synchronizes CRDT deltas and peer awareness across instances, while Redis distributed locks (`SET NX PX`) prevent concurrent database flush race conditions.

---

## 3. Communication & Data Flows

### 3.1 Authentication & Token Issuance Flow

Before a client can open a WebSocket connection to collaborate on a document, canvas, or sketchboard, it must exchange its web session cookie for a short-lived signed room token:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant Web as Next.js API Route (/collab-token)
    participant DB as Neon PostgreSQL
    participant Collab as Collab WebSocket Server (Port 1234)

    User->>Web: 1. GET /api/workspaces/{id}/pages/{pageId}/collab-token
    Note over Web: Session validated via Better Auth Cookie
    Web->>DB: 2. Query WorkspaceMember role for user
    DB-->>Web: 3. Return role (OWNER | ADMIN | EDITOR | VIEWER)
    Web->>Web: 4. Sign HMAC-SHA256 Token (Room, User, Role, 60s TTL)
    Web-->>User: 5. Return JSON { token, url: "ws://..." }

    User->>Collab: 6. Connect WebSocket: ws://host:1234/?token={token}
    Collab->>Collab: 7. Verify HMAC-SHA256 signature & check expiry
    Collab->>DB: 8. Verify active workspace membership
    DB-->>Collab: 9. Membership confirmed
    Collab-->>User: 10. WebSocket Handshake Accepted (canEdit: true/false)
```

---

### 3.2 Document Editing & CRDT Synchronization Flow

Document changes are modeled as Conflict-Free Replicated Data Types (CRDTs) to ensure eventual consistency without central locking:

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Client 1)
    participant YDocA as Alice Y.Doc
    participant Collab as Collab Server (Room Y.Doc)
    participant YDocB as Bob Y.Doc
    actor Bob as Bob (Client 2)
    participant DB as PostgreSQL

    Alice->>YDocA: 1. Types text in Tiptap Editor
    YDocA->>YDocA: 2. Local mutation applied to Y.XmlFragment
    YDocA->>Collab: 3. Binary CRDT update chunk sent over WS
    Note over Collab: Collab Server applies update to in-memory Y.Doc
    Collab-->>YDocB: 4. Broadcast binary update chunk to Bob
    YDocB->>Bob: 5. ProseMirror view renders Alice's edit (<50ms)
    
    Note over Collab: 2s debounce timer starts
    Collab->>Collab: 6. Y.encodeStateAsUpdate(doc) [Compaction]
    Collab->>DB: 7. Persist compacted snapshot to yjs_documents
```

---

### 3.3 Canvas & Sketchboard Synchronization Flow

The Spatial Canvas and Sketchboard engines synchronize spatial objects (`nodes` and `elements`) using a `Y.Map` collection:

```mermaid
sequenceDiagram
    autonumber
    actor User as Designer / Engineer
    participant Engine as Canvas Engine (React 19)
    participant YMap as Y.Map ("nodes")
    participant Server as Collab Server
    participant Redis as Redis Pub/Sub
    participant DB as PostgreSQL

    User->>Engine: 1. Drag & drop Sticky Note / Draw Stroke
    Engine->>YMap: 2. Set node key in shared Y.Map
    YMap->>Server: 3. Stream binary update via WebSocket
    Server->>Server: 4. Apply update to room Y.Doc
    Server->>Redis: 5. Publish delta to "syncspace:collab:room:{room}:updates"
    Redis-->>Server: 6. Forward delta to peer instances (if scaled)
    Server-->>Engine: 7. Stream update to other connected users

    Note over Server: Mark room dirty & trigger 2s debounce
    Server->>Server: 8. Compact Yjs binary snapshot
    Server->>Server: 9. Serialize nodes into JSON AST array
    Server->>DB: 10. Upsert Canvas/Sketchboard (Binary + JSON)
```

---

### 3.4 Multi-Server Redis Coordination Architecture

When scaling horizontally across multiple container instances, Redis 7 acts as the inter-process message bus and concurrency manager:

```mermaid
flowchart TD
    subgraph Instance1 ["Collab Server Instance 1 (Port 1234)"]
        Room1A["Room: page-123 (Client A)"]
    end

    subgraph Instance2 ["Collab Server Instance 2 (Port 1235)"]
        Room2A["Room: page-123 (Client B)"]
    end

    subgraph Redis7 ["Redis 7 Cluster / PubSub & Mutex"]
        ChannelUpdates["Channel: syncspace:collab:room:page-123:updates"]
        ChannelAwareness["Channel: syncspace:collab:room:page-123:awareness"]
        DistLock["Distributed Mutex: syncspace:collab:lock:page-123"]
    end

    Room1A -- "Publish Local CRDT Chunk" --> ChannelUpdates
    ChannelUpdates -- "Broadcast CRDT Chunk" --> Room2A

    Room1A -- "Publish Cursor Position" --> ChannelAwareness
    ChannelAwareness -- "Broadcast Cursor Position" --> Room2A

    Room1A -.->|"Acquire Flush Lock (SET NX PX)"| DistLock
    Room2A -.->|"Lock Busy -> Skip Concurrent Write"| DistLock
```

#### Redis Distributed Mutex
When multiple servers host clients in the same room, debounced persistence flushes could race against each other. SyncSpace eliminates database write contention using Redis distributed mutex locks:
```typescript
const lockAcquired = await redis.set(
  `syncspace:collab:lock:${roomName}`,
  instanceId,
  "PX",
  15000,
  "NX"
);
if (lockAcquired) {
  await flushToPostgres(roomName, ydoc);
}
```
If the lock is currently held by another instance, the second instance defers its flush, ensuring safe, single-writer consistency.

---

### 3.5 Reconnection and Recovery Flow

When a client loses network connectivity (e.g., WiFi drop or laptop sleep), SyncSpace handles recovery automatically without data loss:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client Browser
    participant Collab as Collab WebSocket Server
    participant DB as PostgreSQL

    Note over Client: Network connection drops (Offline)
    Client->>Client: Queue local user edits in local memory Y.Doc
    Note over Client: Network restored -> Trigger reconnect
    Client->>Client: Refresh Collab Token via GET /collab-token
    Client->>Collab: 1. WebSocket Reconnect with fresh token
    Collab-->>Client: 2. Connection Accepted

    Client->>Collab: 3. Sync Step 1: Send local StateVector
    Collab->>Collab: 4. Compute delta of missed server changes
    Collab-->>Client: 5. Sync Step 2: Send missing server CRDT updates
    Collab->>Client: 6. Sync Step 1: Send server StateVector
    Client-->>Collab: 7. Sync Step 2: Send queued offline edits
    Note over Collab: Yjs CRDT automatically merges both edit streams
    Collab-->>Client: 8. Room state fully synchronized (0 conflicts)
```

---

## 4. Architectural Guarantees & Constraints

1. **Eventual Consistency**: By leveraging Yjs CRDTs, concurrent edits to the same document block or canvas node converge deterministically across all peers regardless of message arrival order.
2. **Zero Context Switching**: Documents, flowcharts, and sticky wireframes share the same workspace security boundary, allowing engineers and designers to reference specs alongside visual diagrams.
3. **Compacted Snapshot Storage**: CRDT tombstones (deleted items) are compacted into a unified snapshot upon each database flush, reducing snapshot sizes by up to 80% compared to raw transactional logs.
4. **Resilient Degradation**: If Redis becomes unavailable, the collaboration server automatically degrades to standalone in-memory routing, keeping connected clients online without throwing unhandled exceptions.
