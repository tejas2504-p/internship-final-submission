# SyncSpace — REST & Real-Time API Reference

This document provides exhaustive reference documentation for all REST API endpoints, WebSocket collaboration protocols, authentication mechanisms, authorization rules, and error envelopes implemented in **SyncSpace**.

---

## 1. Authentication & Security Conventions

### 1.1 Session Authentication
Protected REST endpoints require an active session managed via **Better Auth**.
- **Mechanism**: Secure, HTTP-only cookie (`better-auth.session_token`).
- **Unauthenticated Error**: Returns `401 Unauthorized` if the session is absent or expired:
  ```json
  { "error": "Unauthorized" }
  ```

### 1.2 Authorization & Role-Based Access Control (RBAC)
Workspace endpoints enforce role verification against the database:
- `OWNER`: Full administrative control, deletion of workspace, transfer of ownership.
- `ADMIN`: Manage settings, invite/remove members, cannot remove Owner.
- `EDITOR`: Create and mutate pages, canvas objects, sketchboard elements, comments, and versions.
- `VIEWER`: Read-only access; mutations return `403 Forbidden`.

### 1.3 Standard Error Format
All endpoints return consistent JSON error envelopes:
```json
{
  "error": "Human-readable description of error",
  "details": "Optional validation breakdown"
}
```

---

## 2. Authentication Endpoints (Better Auth)

| Endpoint | Method | Auth | Description |
| :--- | :---: | :---: | :--- |
| `/api/auth/sign-up/email` | `POST` | Public | Register a new user with email and password |
| `/api/auth/sign-in/email` | `POST` | Public | Authenticate user and issue session cookie |
| `/api/auth/sign-out` | `POST` | Session | Revoke current session cookie |
| `/api/auth/get-session` | `GET` | Session | Return current authenticated user profile |

---

## 3. Workspace Management Endpoints

### 3.1 List User Workspaces
- **Method**: `GET /api/workspaces`
- **Auth**: Authenticated User
- **Response `200 OK`**:
  ```json
  {
    "workspaces": [
      {
        "id": "cmv123...",
        "name": "Engineering Workspace",
        "description": "Core product specifications",
        "icon": "🚀",
        "ownerId": "usr123...",
        "role": "OWNER",
        "createdAt": "2026-11-01T12:00:00.000Z",
        "updatedAt": "2026-11-01T12:00:00.000Z",
        "_count": { "members": 5, "pages": 12 }
      }
    ]
  }
  ```

### 3.2 Create Workspace
- **Method**: `POST /api/workspaces`
- **Auth**: Authenticated User
- **Request Body**:
  ```json
  {
    "name": "Product Design",
    "description": "Wireframes and specifications",
    "icon": "🎨"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "workspace": {
      "id": "cmv456...",
      "name": "Product Design",
      "description": "Wireframes and specifications",
      "icon": "🎨",
      "ownerId": "usr123...",
      "createdAt": "2026-11-02T10:00:00.000Z"
    }
  }
  ```

### 3.3 Get Workspace Details
- **Method**: `GET /api/workspaces/[workspaceId]`
- **Auth**: Any Workspace Member (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`)
- **Response `200 OK`**: Returns workspace metadata, member list, and `currentUserRole`.

### 3.4 Update Workspace Settings
- **Method**: `PATCH /api/workspaces/[workspaceId]`
- **Auth**: `OWNER` or `ADMIN`
- **Request Body**: `{ "name": "New Name", "description": "...", "icon": "⚡" }`
- **Response `200 OK`**: Updated workspace object.

### 3.5 Delete Workspace
- **Method**: `DELETE /api/workspaces/[workspaceId]`
- **Auth**: `OWNER` only
- **Response `200 OK`**: `{ "success": true, "message": "Workspace deleted" }`

### 3.6 Workspace Activity Feed
- **Method**: `GET /api/workspaces/[workspaceId]/activity`
- **Auth**: Any Workspace Member
- **Query Params**: `take` (default 50), `cursor` (pagination)
- **Response `200 OK`**: Array of audit log events with actor metadata.

### 3.7 Workspace Search
- **Method**: `GET /api/workspaces/[workspaceId]/search`
- **Auth**: Any Workspace Member
- **Query Params**: `q` (search query string)
- **Response `200 OK`**: Matched pages, canvas nodes, and sketchboard elements.

---

## 4. Memberships & Invitations Endpoints

### 4.1 List Workspace Members
- **Method**: `GET /api/workspaces/[workspaceId]/members`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Array of members with user profile and assigned roles.

### 4.2 Update Member Role
- **Method**: `PATCH /api/workspaces/[workspaceId]/members`
- **Auth**: `OWNER` or `ADMIN`
- **Request Body**: `{ "memberId": "mem_2", "role": "EDITOR" }`
- **Response `200 OK`**: Updated member record.

### 4.3 Remove Workspace Member
- **Method**: `DELETE /api/workspaces/[workspaceId]/members?memberId=mem_2`
- **Auth**: `OWNER` or `ADMIN`
- **Response `200 OK`**: `{ "success": true, "message": "Member removed successfully" }`

### 4.4 List Pending Invitations
- **Method**: `GET /api/workspaces/[workspaceId]/invitations`
- **Auth**: `OWNER` or `ADMIN`
- **Response `200 OK`**: Array of active invitation records.

### 4.5 Issue Workspace Invitation
- **Method**: `POST /api/workspaces/[workspaceId]/invitations`
- **Auth**: `OWNER` or `ADMIN` (Rate limited: 10/min)
- **Request Body**: `{ "email": "teammate@example.com", "role": "EDITOR" }`
- **Response `201 Created`**: Returns invitation details and acceptance URL.

### 4.6 Cancel Invitation
- **Method**: `DELETE /api/workspaces/[workspaceId]/invitations/[invitationId]`
- **Auth**: `OWNER` or `ADMIN`
- **Response `200 OK`**: `{ "success": true, "message": "Invitation cancelled" }`

### 4.7 Get Invitation by Token (Public)
- **Method**: `GET /api/invitations/[token]`
- **Auth**: Public
- **Response `200 OK`**: Invitation summary, inviter name, and workspace name.

### 4.8 Accept Invitation
- **Method**: `POST /api/invitations/[token]/accept`
- **Auth**: Authenticated User (email must match invitation email)
- **Response `200 OK`**: `{ "success": true, "workspaceId": "ws_1" }`

### 4.9 Reject Invitation
- **Method**: `POST /api/invitations/[token]/reject`
- **Auth**: Authenticated User
- **Response `200 OK`**: `{ "success": true, "message": "Invitation declined" }`

---

## 5. Document Pages Endpoints

### 5.1 List Workspace Pages
- **Method**: `GET /api/workspaces/[workspaceId]/pages`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Array of page objects ordered by `updatedAt DESC`.

### 5.2 Create Page
- **Method**: `POST /api/workspaces/[workspaceId]/pages`
- **Auth**: `OWNER`, `ADMIN`, `EDITOR`
- **Request Body**: `{ "title": "Architecture Spec", "content": "{...}" }`
- **Response `201 Created`**: Created page object.

### 5.3 Get Page
- **Method**: `GET /api/workspaces/[workspaceId]/pages/[pageId]`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Full page details including content, creator, and timestamps.

### 5.4 Update Page
- **Method**: `PATCH /api/workspaces/[workspaceId]/pages/[pageId]`
- **Auth**: `OWNER`, `ADMIN`, `EDITOR`
- **Request Body**: `{ "title": "Updated Title", "content": "{...}" }`
- **Response `200 OK`**: Updated page object.

### 5.5 Delete Page
- **Method**: `DELETE /api/workspaces/[workspaceId]/pages/[pageId]`
- **Auth**: `OWNER`, `ADMIN`, `EDITOR`
- **Response `200 OK`**: `{ "success": true, "message": "Page deleted" }`

### 5.6 Request Page Collaboration Token
- **Method**: `GET /api/workspaces/[workspaceId]/pages/[pageId]/collab-token`
- **Auth**: Any Workspace Member
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "wsUrl": "ws://localhost:1234",
    "roomName": "page:cmw123...",
    "role": "EDITOR",
    "canEdit": true,
    "user": { "id": "usr_1", "name": "Alice", "color": "#4f46e5" }
  }
  ```

---

## 6. Comments & Version History Endpoints

### 6.1 List Comments
- **Method**: `GET /api/workspaces/[workspaceId]/pages/[pageId]/comments`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Chronological comment list with author metadata.

### 6.2 Add Comment
- **Method**: `POST /api/workspaces/[workspaceId]/pages/[pageId]/comments`
- **Auth**: `OWNER`, `ADMIN`, `EDITOR`
- **Request Body**: `{ "content": "Should we optimize the CRDT debounce time?" }`
- **Response `201 Created`**: Created comment record.

### 6.3 Delete Comment
- **Method**: `DELETE /api/workspaces/[workspaceId]/pages/[pageId]/comments/[commentId]`
- **Auth**: Author of comment, or `OWNER` / `ADMIN`
- **Response `200 OK`**: `{ "success": true, "message": "Comment deleted" }`

### 6.4 List Document Versions
- **Method**: `GET /api/workspaces/[workspaceId]/pages/[pageId]/versions`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Reverse-chronological revision history snapshots.

### 6.5 Create Document Version Snapshot
- **Method**: `POST /api/workspaces/[workspaceId]/pages/[pageId]/versions`
- **Auth**: `OWNER`, `ADMIN`, `EDITOR`
- **Request Body**: `{ "content": "{...}" }`
- **Response `201 Created`**: Created revision snapshot.

### 6.6 Restore Document Version
- **Method**: `POST /api/workspaces/[workspaceId]/pages/[pageId]/versions/[versionId]`
- **Auth**: `OWNER`, `ADMIN`, `EDITOR`
- **Response `200 OK`**: Restores page content to selected version snapshot.

---

## 7. Spatial Canvas & Sketchboard Endpoints

### 7.1 Spatial Canvas Endpoints
- `GET /api/workspaces/[workspaceId]/canvas` — Fetch canvas state (JSON nodes array and viewport).
- `PUT /api/workspaces/[workspaceId]/canvas` — Save canvas nodes, viewport, and revision counter.
- `GET /api/workspaces/[workspaceId]/canvas/collab-token` — Issue signed token for `canvas:[workspaceId]`.

### 7.2 Primary Sketchboard Endpoints
- `GET /api/workspaces/[workspaceId]/sketchboard` — Fetch primary workspace sketchboard.
- `PUT /api/workspaces/[workspaceId]/sketchboard` — Save sketchboard elements, gridMode, and background tint.
- `GET /api/workspaces/[workspaceId]/sketchboard/collab-token` — Issue signed token for `sketchboard:[workspaceId]`.

### 7.3 Multi-Sketchboard Endpoints
- `GET /api/workspaces/[workspaceId]/sketchboards` — List all sketchboards in workspace.
- `POST /api/workspaces/[workspaceId]/sketchboards` — Create a new sketchboard.
- `GET /api/workspaces/[workspaceId]/sketchboards/[boardId]` — Fetch specific sketchboard details.
- `PATCH /api/workspaces/[workspaceId]/sketchboards/[boardId]` — Update sketchboard title or background.
- `DELETE /api/workspaces/[workspaceId]/sketchboards/[boardId]` — Delete sketchboard.
- `GET /api/workspaces/[workspaceId]/sketchboards/[boardId]/collab-token` — Issue signed token for `sketchboard:[boardId]`.

---

## 8. WebSocket Collaboration Protocol

- **Endpoint**: `ws://<host>:1234/?token=<signedToken>`
- **Handshake Verification**:
  1. HMAC-SHA256 signature and expiration (60s TTL) verified.
  2. Workspace membership role confirmed via PostgreSQL.
  3. Connection admitted with `canEdit` flag.
- **Binary Protocols**:
  - **Message Type 0 (Sync)**: Yjs CRDT synchronization (Sync Step 1 StateVector, Sync Step 2 Update).
  - **Message Type 1 (Awareness)**: Ephemeral cursor positions `{ x, y }`, user info, and selection state.
- **Write Protection**:
  - Connections with `canEdit: false` (role `VIEWER`) have all incoming Type 0 frames dropped by the server.

### 8.1 Server Health Endpoint
- **Method**: `GET http://<host>:1234/health`
- **Description**: Container liveness probe and operational metrics.
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "SyncSpace Collaboration Server",
    "version": "Phase 7B (Multi-Server Distributed Collaboration)",
    "port": 1234,
    "host": "0.0.0.0",
    "activeRooms": 2,
    "dirtyRooms": 0,
    "uptime": 2341.2,
    "redis": {
      "enabled": false,
      "connected": false
    }
  }
  ```
