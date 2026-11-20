# SyncSpace — Database Schema & Data Models

This document details the PostgreSQL database schema, Prisma models, entity relationships, constraints, indexes, and persistence mechanics implemented in **SyncSpace**.

---

## 1. Entity-Relationship Overview

```mermaid
erDiagram
    User ||--o{ Session : "has"
    User ||--o{ Account : "has"
    User ||--o{ Workspace : "owns"
    User ||--o{ WorkspaceMember : "belongs to"
    User ||--o{ Page : "creates"
    User ||--o{ Comment : "authors"
    User ||--o{ DocumentVersion : "creates"
    User ||--o{ Canvas : "last saves"
    User ||--o{ WorkspaceInvitation : "invites"
    User ||--o{ WorkspaceActivity : "performs"

    Workspace ||--o{ WorkspaceMember : "contains"
    Workspace ||--o{ Page : "contains"
    Workspace ||--o| Canvas : "has"
    Workspace ||--o{ WorkspaceInvitation : "issues"
    Workspace ||--o{ WorkspaceActivity : "logs"

    Page ||--o{ Comment : "has"
    Page ||--o{ DocumentVersion : "has"
    Page ||--o| YjsDocument : "persists as"
```

---

## 2. Prisma Enums

### 2.1 `WorkspaceRole`
Defines the role-based access control (RBAC) hierarchy for workspace members:
```prisma
enum WorkspaceRole {
  OWNER    // Creator or transferred owner; full administrative control
  ADMIN    // Can manage settings, invite/remove members, cannot remove OWNER
  EDITOR   // Full read/write access to pages, canvas, comments, and versions
  MEMBER   // Standard legacy member (equivalent to EDITOR permissions)
  VIEWER   // Read-only access to pages, canvas, and activity; cannot edit or mutate state
}
```

### 2.2 `InvitationStatus`
Tracks the lifecycle of email-based workspace invitations:
```prisma
enum InvitationStatus {
  PENDING    // Invite issued and awaiting recipient action
  ACCEPTED   // Recipient authenticated and accepted membership
  REJECTED   // Recipient explicitly declined the invite
  EXPIRED    // Invite reached expiration timestamp (7-day TTL)
  CANCELLED  // Admin or Owner revoked the invitation before acceptance
}
```

---

## 3. Core Models & Tables

### 3.1 Authentication & User Management (Better Auth)

#### Table: `users`
Represents an authenticated user identity in the system.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique identifier |
| `name` | `String` | | Full display name |
| `email` | `String` | `@unique` | Unique email address |
| `emailVerified` | `Boolean` | `@default(false)` | Email verification flag |
| `image` | `String?` | | Profile avatar URL |
| `passwordHash` | `String?` | | Argon2/Bcrypt hash for password auth |
| `createdAt` | `DateTime` | `@default(now())` | Account creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last profile update timestamp |

#### Table: `sessions`
Active browser authentication sessions.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique session record ID |
| `token` | `String` | `@unique` | Session token stored in HTTP cookie |
| `userId` | `String` | `FK -> users.id` | Associated user identity |
| `expiresAt` | `DateTime` | | Expiration timestamp |
| `ipAddress` | `String?` | | Client IP address at login |
| `userAgent` | `String?` | | Client browser user agent |
| `createdAt` | `DateTime` | `@default(now())` | Session creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last activity update timestamp |

*Indexes*: `@@index([userId])`

#### Table: `accounts`
Third-party OAuth identity links (GitHub, Google) and local password credentials.
*Indexes*: `@@index([userId])`

#### Table: `verifications`
One-time email verification and password reset tokens.
*Indexes*: `@@index([identifier])`

---

### 3.2 Workspace & Membership Subsystem

#### Table: `workspaces`
Organizational boundary for projects, documents, canvases, and teams.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique workspace ID |
| `name` | `String` | | Workspace display name |
| `description` | `String?` | `@db.Text` | Optional workspace description |
| `icon` | `String?` | | Emoji or icon identifier |
| `ownerId` | `String` | `FK -> users.id` | Workspace owner identifier |
| `createdAt` | `DateTime` | `@default(now())` | Workspace creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last modification timestamp |

*Indexes*: `@@index([ownerId])`

#### Table: `workspace_members`
Association table connecting users to workspaces with assigned RBAC roles.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique membership ID |
| `userId` | `String` | `FK -> users.id` | Member user ID |
| `workspaceId` | `String` | `FK -> workspaces.id` | Target workspace ID |
| `role` | `WorkspaceRole` | `@default(MEMBER)` | Assigned RBAC role |
| `createdAt` | `DateTime` | `@default(now())` | Timestamp member joined |

*Constraints & Indexes*:
- `@@unique([workspaceId, userId])` — Guarantees a user cannot have duplicate memberships in the same workspace.
- `@@index([userId])` — Fast lookup of all workspaces for a user.
- `@@index([workspaceId])` — Fast lookup of all members in a workspace.
- `@@index([workspaceId, createdAt])` — Chronological member sorting.

---

### 3.3 Document Editor & Collaborative Subsystem

#### Table: `pages`
Notion-style block documents within a workspace.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique page ID |
| `title` | `String` | `@default("Untitled")` | Document title |
| `content` | `String?` | `@db.Text` | ProseMirror JSON document string |
| `workspaceId` | `String` | `FK -> workspaces.id` | Enclosing workspace |
| `createdById` | `String` | `FK -> users.id` | Document creator |
| `createdAt` | `DateTime` | `@default(now())` | Creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last modified timestamp |

*Indexes*:
- `@@index([workspaceId])`
- `@@index([createdById])`
- `@@index([workspaceId, updatedAt(sort: Desc)])` — Optimized for recent document feeds.

#### Table: `yjs_documents`
Durable binary Yjs CRDT snapshots for real-time document collaboration.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique record ID |
| `pageId` | `String` | `@unique, FK -> pages.id` | 1-to-1 association with page |
| `snapshot` | `Bytes` | | Compacted binary Yjs state update |
| `createdAt` | `DateTime` | `@default(now())` | Initial creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last snapshot compaction flush |

*Indexes*: `@@index([pageId])`

#### Table: `comments`
Discussion threads attached to document pages.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique comment ID |
| `content` | `String` | `@db.Text` | Comment body text |
| `pageId` | `String` | `FK -> pages.id` | Target document page |
| `authorId` | `String` | `FK -> users.id` | Comment author |
| `createdAt` | `DateTime` | `@default(now())` | Timestamp posted |
| `updatedAt` | `DateTime` | `@updatedAt` | Last edit timestamp |

*Indexes*:
- `@@index([pageId])`
- `@@index([authorId])`
- `@@index([pageId, createdAt(sort: Asc)])` — Chronological comment thread ordering.

#### Table: `document_versions`
Immutable document snapshots for version history and point-in-time recovery.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique revision ID |
| `pageId` | `String` | `FK -> pages.id` | Associated document page |
| `content` | `String` | `@db.Text` | Frozen ProseMirror JSON snapshot |
| `createdById` | `String` | `FK -> users.id` | User who created the version |
| `createdAt` | `DateTime` | `@default(now())` | Snapshot timestamp |

*Indexes*:
- `@@index([pageId])`
- `@@index([createdById])`
- `@@index([pageId, createdAt(sort: Desc)])` — Reverse-chronological revision history.

---

### 3.4 Spatial Canvas & Whiteboard Subsystem

#### Table: `canvases`
Infinite spatial whiteboard associated with a workspace.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique canvas ID |
| `workspaceId` | `String` | `@unique, FK -> workspaces.id` | 1-to-1 association with workspace |
| `name` | `String` | `@default("Spatial Canvas")`| Whiteboard title |
| `description` | `String?` | `@db.Text` | Optional description |
| `nodes` | `Json` | `@default("[]")` | Extracted JSON AST array of canvas nodes |
| `viewport` | `Json?` | | Zoom, pan offset `{x, y, zoom}` |
| `yjsSnapshot` | `Bytes?` | | Compacted binary Yjs CRDT state vector |
| `version` | `Int` | `@default(1)` | Monotonic persistence revision counter |
| `lastSavedById`| `String?`| `FK -> users.id` | User who authored the last saved state |
| `createdAt` | `DateTime` | `@default(now())` | Canvas creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last state flush timestamp |

*Indexes*: `@@index([workspaceId])`

---

### 3.5 Governance, Invitations & Audit Subsystem

#### Table: `workspace_invitations`
Email invitation tokens for onboarding members with predefined roles.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique invitation record ID |
| `workspaceId` | `String` | `FK -> workspaces.id` | Target workspace |
| `email` | `String` | | Invitee email address |
| `role` | `WorkspaceRole` | `@default(MEMBER)` | Role granted upon acceptance |
| `token` | `String` | `@unique @default(cuid())` | Cryptographically random acceptance token |
| `status` | `InvitationStatus`| `@default(PENDING)` | Current status |
| `inviterId` | `String` | `FK -> users.id` | User issuing the invitation |
| `expiresAt` | `DateTime` | | Expiration timestamp (7-day TTL) |
| `createdAt` | `DateTime` | `@default(now())` | Issue timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last status update timestamp |

*Indexes*:
- `@@index([workspaceId])`
- `@@index([email])`
- `@@index([token])`
- `@@index([workspaceId, status])` — Active pending invite filtering.

#### Table: `workspace_activities`
Auditable event log tracking all workspace actions.
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(cuid())` | Unique event ID |
| `workspaceId` | `String` | `FK -> workspaces.id` | Target workspace |
| `actorId` | `String` | `FK -> users.id` | User performing the action |
| `action` | `String` | | Action enum name (e.g. `PAGE_CREATED`) |
| `entityType` | `String` | | Target entity type (`page`, `canvas`, `member`) |
| `entityId` | `String?` | | Identifier of target entity |
| `metadata` | `Json?` | | Contextual payload (names, titles, roles) |
| `createdAt` | `DateTime` | `@default(now())` | Event timestamp |

*Indexes*:
- `@@index([workspaceId])`
- `@@index([actorId])`
- `@@index([createdAt])`
- `@@index([workspaceId, createdAt(sort: Desc)])` — Optimized workspace audit feed.

---

## 4. Dual Persistence Strategy

SyncSpace avoids data-loss edge cases and cold-start performance lag by storing dual representations of collaborative state:

```mermaid
flowchart LR
    YDoc["Active Y.Doc in Memory"]
    
    subgraph Serialization ["Dual Serialization Process"]
        BinCompaction["Y.encodeStateAsUpdate(doc)"]
        ASTExtract["Extract JSON Nodes / ProseMirror AST"]
    end
    
    subgraph Storage ["PostgreSQL Tables"]
        SnapshotCol["yjsSnapshot / snapshot (Bytes)"]
        JSONCol["nodes / content (JSON / Text)"]
    end
    
    YDoc --> BinCompaction
    YDoc --> ASTExtract
    BinCompaction --> SnapshotCol
    ASTExtract --> JSONCol
```

1. **Binary Yjs Snapshot (`Bytes`)**: Contains the compacted CRDT state vector. When a collaboration server initializes a room, it reads this column directly into memory, preserving complete CRDT causal history, conflict-free convergence, and sub-second load times.
2. **Extracted JSON (`Json` / `Text`)**: Provides a human-readable and queryable representation. Used for:
   - Full-text cross-workspace search queries via SQL `ILIKE`.
   - SSR previews and read-only static rendering without initializing the Yjs WASM runtime.
   - REST API consumption for external webhooks and integrations.

