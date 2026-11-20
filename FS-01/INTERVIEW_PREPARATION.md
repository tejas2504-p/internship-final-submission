# SyncSpace — Technical Interview Guide & Architecture Deep-Dive

This document is engineered to prepare you for technical interviews, system design discussions, and portfolio walkthroughs for **SyncSpace**.

---

## 1. The Two-Minute Elevator Pitch

> *"SyncSpace is a production-grade, real-time collaborative workspace designed to eliminate tool sprawl between modern product and engineering teams. Today, teams fragment their workflows across Notion for documentation, Miro for diagrams, and Figma for wireframes. SyncSpace unifies them into a dual-engine architecture: a structured Notion-style block editor and an infinite Figma-style spatial canvas.*
>
> *Under the hood, I built this using Next.js 16 (React 19) and a decoupled real-time collaboration engine using Yjs Conflict-Free Replicated Data Types (CRDTs). To solve horizontal scaling across server clusters, I implemented a Redis 7 coordination layer handling Pub/Sub update distribution, cross-server awareness broadcasting, and distributed persistence locking.*
>
> *State is persisted in Neon PostgreSQL using a dual-format model: compacted binary Yjs snapshots for instant CRDT cold starts and extracted JSON AST for fast search and server-side rendering. The entire system is protected by granular role-based access control, cryptographic token handshakes, sliding-window rate limiting, and automated compaction to prevent CRDT history bloat."*

---

## 2. In-Depth Architecture Explanation (End-to-End Lifecycle)

### What happens when User A drops a sticky note on the canvas?

```mermaid
sequenceDiagram
    autonumber
    actor UserA as User A (Browser)
    actor UserB as User B (Browser)
    participant WS1 as Collab Server 1
    participant Redis as Redis 7 Pub/Sub
    participant WS2 as Collab Server 2
    participant DB as Neon PostgreSQL

    UserA->>UserA: 1. Local click creates Sticky Note
    UserA->>UserA: 2. Local Y.Map('nodes').set(id, node)
    UserA->>WS1: 3. Binary Yjs CRDT update over WebSocket
    Note over WS1: WS1 checks client.canEdit (RBAC)
    WS1->>WS1: 4. Y.applyUpdate(roomDoc, update)
    WS1-->>UserA: 5. Acknowledge update

    par Broadcast via Redis
        WS1->>Redis: 6. Publish update to syncspace:collab:room:updates
        Redis->>WS2: 7. Forward update to Server 2
        WS2->>WS2: 8. Y.applyUpdate(roomDoc, update)
        WS2->>UserB: 9. Forward binary frame to User B
        UserB->>UserB: 10. CRDT converges; Sticky note appears!
    end

    Note over WS1: 11. 2-second debounce timer expires
    WS1->>Redis: 12. Acquire lock (SET NX PX 15000)
    Redis-->>WS1: Lock granted
    WS1->>WS1: 13. Y.encodeStateAsUpdate(roomDoc) [Compaction]
    WS1->>DB: 14. Upsert canvas (yjsSnapshot + JSON nodes)
    WS1->>Redis: 15. Release flush lock
```

1. **Local Action**: User A clicks and drops a sticky note on the canvas.
2. **Local CRDT Mutation**: The local `useCanvas` hook updates its in-memory `Y.Doc` using a `Y.Map<CanvasNode>` data structure within a `doc.transact(...)` block.
3. **Binary Network Transmission**: The `y-websocket` provider serializes the incremental delta into a compact binary frame (`Message Type 0`) and sends it over the WebSocket connection to Collab Server 1.
4. **Server Write Validation**: Collab Server 1 intercepts the message and verifies `client.canEdit === true` (enforced during the HMAC-SHA256 handshake).
5. **Cross-Server Fanout**:
   - Collab Server 1 applies the update to its in-memory `Y.Doc`.
   - If Redis is enabled, Server 1 publishes the binary payload to Redis channel `syncspace:collab:room:{roomName}:updates`.
   - Collab Server 2 (subscribed to the room channel) receives the message and applies the delta to its local room instance.
   - Server 2 immediately streams the binary update frame down to User B.
6. **Deterministic Convergence**: User B's browser applies the delta. Because Yjs is a mathematically proven CRDT, both browsers arrive at the exact same state without any central merge coordinator.
7. **Debounced Compaction & Durable Persistence**:
   - Both servers mark their local room dirty. After a 2-second debounce interval, Server 1 attempts to acquire a distributed Redis lock.
   - Server 1 wins the lock, compacts the room's CRDT state vector (`Y.encodeStateAsUpdate`), extracts the JSON AST, and performs an atomic SQL `UPSERT` into Neon PostgreSQL.

---

## 3. Important Technical Decisions & Trade-Offs

### 3.1 CRDT (Yjs) vs. Operational Transformation (OT)
- **Why CRDT?** Operational Transformation (used in Google Docs) relies on a single authoritative central server to sequence and transform concurrent operations. This makes multi-region horizontal scaling, network partition recovery, and offline editing notoriously complex. CRDTs provide mathematically proven eventual consistency without a central sequencer.
- **Why Yjs specifically?** Yjs is the fastest open-source CRDT engine in JavaScript, utilizing a uniquely optimized struct-store that outperforms Automerge by 10x in memory efficiency and execution speed.

### 3.2 Decoupled Node.js WebSocket Daemon vs. Serverless WebSockets
- **Decision**: Separated the collaboration server (`collaboration-server/server.ts`) from the Next.js serverless app.
- **Trade-off**: Requires hosting a containerized long-running process (e.g. Railway or Render) rather than a 100% serverless deployment.
- **Why?** Serverless functions have execution time limits (15–60s) and cannot hold persistent duplex TCP/WSS sockets. In addition, holding in-memory `Y.Doc` instances across edits avoids reading and writing to PostgreSQL on every keystroke, reducing database costs and latency to near-zero.

### 3.3 Dual Persistence: Binary Yjs Snapshot + Extracted JSON
- **Decision**: Persist both `yjsSnapshot` (`Bytes`) and `nodes` (`Json`) in PostgreSQL.
- **Why not just JSON?** Reconstructing a CRDT document from plain JSON destroys operation IDs and causal history, causing duplicate items when users reconnect.
- **Why not just binary?** Binary snapshots cannot be queried with SQL `ILIKE` for search, cannot be inspected in database GUIs, and cannot be rendered server-side without executing the Yjs runtime. The dual approach provides full CRDT fidelity plus instant searchability.

### 3.4 Redis Pub/Sub vs. Message Queues (Kafka / RabbitMQ)
- **Decision**: Used Redis Pub/Sub (`ioredis`) for inter-server collaboration coordination.
- **Why?** Real-time cursor coordinates and ephemeral awareness updates have sub-50ms latency requirements. Message queues like Kafka or RabbitMQ introduce disk persistence, consumer group offsets, and acknowledgment overhead that are unnecessary for ephemeral real-time deltas. Redis Pub/Sub delivers sub-millisecond in-memory fan-out.

---

## 4. Tough Challenges Solved & Debugging Stories

### 4.1 The "Infinite Echo" Loop
- **Situation**: During early testing of the spatial canvas, moving a sticky note caused CPU usage to spike to 100% and froze the browser tab.
- **Root Cause**: When User A moved a note, local React state changed, which notified Yjs. Yjs sent the delta to the server. The server echoed the delta back. User A's `yNodes.observeDeep` listener received the remote event and updated React state, which triggered the local drag listener again, creating an infinite circular feedback loop.
- **Resolution**: Implemented two safeguards:
  1. Transaction origin tagging: mutations initiated from remote updates are tagged with origin `"remote"` or `"persistence-init"`.
  2. Guard ref: Set `isRemoteApplyingRef.current = true` during remote sync updates, instructing local React handlers to skip emitting to Yjs.

### 4.2 CRDT History Bloat & Compaction
- **Situation**: After dragging a sticky note 500 times, the document's serialized update history grew to over 2 MB for a single note. Server restarts took several seconds to replay transactions.
- **Resolution**: Implemented snapshot compaction during database persistence. Instead of storing raw append-only update logs, the server executes `Y.encodeStateAsUpdate(doc)`. This compresses the internal struct store into a single unified state snapshot, reducing state size by up to 80% and ensuring instant room hydration.

### 4.3 Split-Brain Persistence in Distributed Multi-Instance Topologies
- **Situation**: In multi-server testing, Client A was on Port 1234 and Client B was on Port 1235 in the same workspace. Both instances scheduled independent database flushes, leading to database lock contention and race conditions.
- **Resolution**: Designed a distributed mutex in `collaboration-server/redis.ts` using Redis atomic `SET ... NX PX` with a 15-second TTL and unique instance ID lease. Only the lock winner flushes state to PostgreSQL.

---

## 5. Frequently Asked Interview Questions & Answers

### Q1: How does SyncSpace handle offline editing and network reconnections?
> *"SyncSpace leverages Yjs state vectors. When a client loses connection, it continues editing its local Y.Doc in browser memory. When connectivity is restored, the client and server exchange 32-byte StateVectors representing what each side has seen. Only the missing deltas are exchanged and merged deterministically without losing any offline changes."*

### Q2: How do you prevent unauthorized users from tampering with canvas state via WebSockets?
> *"We implement a zero-trust authorization pipeline: First, the client must obtain a short-lived HMAC-SHA256 collaboration token from a Next.js API route that validates session cookies and workspace membership. Second, the collaboration daemon validates the token's cryptographic signature, expiration, and room scope upon connection. Third, for users with the `VIEWER` role, the server flags the connection as read-only and explicitly discards any incoming document mutation binary frames."*

### Q3: What happens if Redis crashes or is unavailable?
> *"SyncSpace implements a zero-downtime fallback. In `collaboration-server/redis.ts`, the adapter detects Redis disconnection and automatically switches to standalone mode. Local clients connected to the same instance continue collaborating with zero interruption, and persistence continues directly to PostgreSQL."*

### Q4: Why did you use Next.js 16 with React 19?
> *"Next.js 16 with Turbopack provides sub-second hot-module reloading and optimized production builds. React 19 Server Components allow us to fetch workspace metadata, page lists, and initial canvas state directly on the server without shipping unnecessary JavaScript to the client. This gives us fast First Contentful Paint (FCP) and optimal SEO."*

### Q5: How do you prevent Denial of Service (DoS) attacks on the collaboration server?
> *"We hardened the collaboration daemon with multiple defensive layers: a strict 10 MB frame limit on `WebSocketServer` (`maxPayload`), a bounded pre-auth message queue (max 50 frames per socket) to prevent unauthenticated memory exhaustion, bounded awareness decoding (capped at 100 client IDs per frame), and sliding-window rate limiting on API token generation endpoints."*

