# SyncSpace — REST & Real-Time API Reference

This document provides complete reference documentation for all REST API endpoints, WebSocket collaboration endpoints, authentication mechanisms, authorization rules, and error schemas implemented in **SyncSpace**.

---

## 1. Authentication & Security Conventions

### 1.1 Session Authentication
All protected REST endpoints authenticate users via an HTTP-only secure cookie managed by **Better Auth**.
- **Header**: Automatically passed via browser cookie: `better-auth.session_token=<token>`
- **Unauthenticated Responses**: If the session cookie is missing or expired, endpoints return `401 Unauthorized`:
  ```json
  { "error": "Unauthorized" }
  ```

### 1.2 Rate Limiting
Sensitive endpoints enforce sliding-window rate limiting. When a client exceeds the permitted threshold, the API responds with `429 Too Many Requests`:
```json
{ "error": "Too many requests. Please try again later." }
```

### 1.3 Standard Error Format
All endpoints return standard JSON error envelopes with descriptive messages:
```json
{
  "error": "Descriptive error message",
  "details": "Optional validation breakdown"
}
```

---

## 2. Workspace Management Endpoints

### 2.1 List Workspaces
- **Method**: `GET /api/workspaces`
- **Auth**: Authenticated User
- **Description**: Returns all workspaces where the current user is an owner or member.
- **Response `200 OK`**:
  ```json
  {
    "workspaces": [
      {
        "id": "cmv123...",
        "name": "Acme Engineering",
        "description": "Core product workspace",
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

### 2.2 Create Workspace
- **Method**: `POST /api/workspaces`
- **Auth**: Authenticated User
- **Request Body**:
  ```json
  {
    "name": "Product Design",
    "description": "Spatial wireframes & docs",
    "icon": "🎨"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "workspace": {
      "id": "cmv456...",
      "name": "Product Design",
      "description": "Spatial wireframes & docs",
      "icon": "🎨",
      "ownerId": "usr123...",
      "createdAt": "2026-11-02T10:00:00.000Z"
    }
  }
  ```

### 2.3 Get Workspace Details
- **Method**: `GET /api/workspaces/[workspaceId]`
- **Auth**: Any Workspace Member (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`)
- **Response `200 OK`**:
  ```json
  {
    "workspace": {
      "id": "cmv123...",
      "name": "Acme Engineering",
      "description": "Core product workspace",
      "icon": "🚀",
      "currentUserRole": "ADMIN",
      "members": [
        { "id": "m1", "userId": "u1", "role": "OWNER", "user": { "name": "Alice", "email": "alice@sync.space" } }
      ]
    }
  }
  ```

### 2.4 Update Workspace Settings
- **Method**: `PATCH /api/workspaces/[workspaceId]`
- **Auth**: `OWNER` or `ADMIN`
- **Request Body**:
  ```json
  {
    "name": "Acme Core Team",
    "description": "Updated engineering hub",
    "icon": "⚡"
  }
  ```
- **Response `200 OK`**: Updated workspace object.

### 2.5 Delete Workspace
- **Method**: `DELETE /api/workspaces/[workspaceId]`
- **Auth**: `OWNER` only
- **Response `200 OK`**:
  ```json
  { "success": true, "message": "Workspace deleted" }
  ```

---

## 3. Membership & Roles Endpoints

### 3.1 List Members
- **Method**: `GET /api/workspaces/[workspaceId]/members`
- **Auth**: Any Workspace Member
- **Response `200 OK`**:
  ```json
  {
    "members": [
      {
        "id": "mem_1",
        "userId": "usr_1",
        "role": "OWNER",
        "createdAt": "2026-11-01T00:00:00.000Z",
        "user": { "id": "usr_1", "name": "Alice", "email": "alice@sync.space", "image": null }
      }
    ]
  }
  ```

### 3.2 Update Member Role
- **Method**: `PATCH /api/workspaces/[workspaceId]/members`
- **Auth**: `OWNER` or `ADMIN` (Admins cannot change Owner's role)
- **Request Body**:
  ```json
  {
    "memberId": "mem_2",
    "role": "EDITOR"
  }
  ```
- **Response `200 OK`**: Updated membership record.

### 3.3 Remove Member
- **Method**: `DELETE /api/workspaces/[workspaceId]/members?memberId=mem_2`
- **Auth**: `OWNER` or `ADMIN` (Cannot remove Owner)
- **Response `200 OK`**:
  ```json
  { "success": true, "message": "Member removed successfully" }
  ```

---

## 4. Workspace Invitations Endpoints

### 4.1 List Pending Invitations
- **Method**: `GET /api/workspaces/[workspaceId]/invitations`
- **Auth**: `OWNER` or `ADMIN`
- **Response `200 OK`**:
  ```json
  {
    "invitations": [
      {
        "id": "inv_1",
        "email": "sarah@company.com",
        "role": "EDITOR",
        "status": "PENDING",
        "expiresAt": "2026-11-09T00:00:00.000Z"
      }
    ]
  }
  ```

### 4.2 Create Invitation
- **Method**: `POST /api/workspaces/[workspaceId]/invitations`
- **Auth**: `OWNER` or `ADMIN` (Rate limited: 10 req/min)
- **Request Body**:
  ```json
  {
    "email": "sarah@company.com",
    "role": "EDITOR"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "invitation": {
      "id": "inv_1",
      "email": "sarah@company.com",
      "role": "EDITOR",
      "token": "tok_xyz...",
      "inviteUrl": "https://syncspace.app/invitations/tok_xyz...",
      "expiresAt": "2026-11-09T00:00:00.000Z"
    }
  }
  ```

### 4.3 Cancel Invitation
- **Method**: `DELETE /api/workspaces/[workspaceId]/invitations/[invitationId]`
- **Auth**: `OWNER` or `ADMIN`
- **Response `200 OK`**:
  ```json
  { "success": true, "message": "Invitation cancelled" }
  ```

### 4.4 Get Invitation by Token (Public)
- **Method**: `GET /api/invitations/[token]`
- **Auth**: Public (Optional session)
- **Response `200 OK`**:
  ```json
  {
    "invitation": {
      "id": "inv_1",
      "email": "sarah@company.com",
      "role": "EDITOR",
      "workspace": { "id": "ws_1", "name": "Acme HQ", "icon": "🚀" },
      "inviter": { "name": "Alice" }
    }
  }
  ```

### 4.5 Accept Invitation
- **Method**: `POST /api/invitations/[token]/accept`
- **Auth**: Authenticated User (Strict check: authenticated email must match invitee email)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "workspaceId": "ws_1",
    "message": "Successfully joined Acme HQ"
  }
  ```

### 4.6 Reject Invitation
- **Method**: `POST /api/invitations/[token]/reject`
- **Auth**: Authenticated User
- **Response `200 OK`**:
  ```json
  { "success": true, "message": "Invitation declined" }
  ```

---

## 5. Document Pages Endpoints

### 5.1 List Pages
- **Method**: `GET /api/workspaces/[workspaceId]/pages`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Array of page summaries ordered by `updatedAt DESC`.

### 5.2 Create Page
- **Method**: `POST /api/workspaces/[workspaceId]/pages`
- **Auth**: `OWNER`, `ADMIN`, or `EDITOR`
- **Request Body**:
  ```json
  {
    "title": "Sprint 42 Architecture Blueprint",
    "content": "{\"type\":\"doc\",\"content\":[...]}"
  }
  ```
- **Response `201 Created`**: Created page object.

### 5.3 Get Page
- **Method**: `GET /api/workspaces/[workspaceId]/pages/[pageId]`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Full page details including creator and ProseMirror content.

### 5.4 Update Page (REST)
- **Method**: `PATCH /api/workspaces/[workspaceId]/pages/[pageId]`
- **Auth**: `OWNER`, `ADMIN`, or `EDITOR`
- **Request Body**:
  ```json
  {
    "title": "Updated Title",
    "content": "{\"type\":\"doc\",\"content\":[...]}"
  }
  ```
- **Response `200 OK`**: Updated page object.

### 5.5 Delete Page
- **Method**: `DELETE /api/workspaces/[workspaceId]/pages/[pageId]`
- **Auth**: `OWNER`, `ADMIN`, or `EDITOR`
- **Response `200 OK`**:
  ```json
  { "success": true, "message": "Page deleted" }
  ```

---

## 6. Document Comments & Version History

### 6.1 List Comments
- **Method**: `GET /api/workspaces/[workspaceId]/pages/[pageId]/comments`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Array of comments sorted chronologically.

### 6.2 Add Comment
- **Method**: `POST /api/workspaces/[workspaceId]/pages/[pageId]/comments`
- **Auth**: `OWNER`, `ADMIN`, or `EDITOR`
- **Request Body**:
  ```json
  { "content": "Should we optimize the CRDT sync debounce interval?" }
  ```
- **Response `201 Created`**: Created comment record.

### 6.3 Delete Comment
- **Method**: `DELETE /api/workspaces/[workspaceId]/pages/[pageId]/comments/[commentId]`
- **Auth**: Comment Author, `OWNER`, or `ADMIN`
- **Response `200 OK`**:
  ```json
  { "success": true }
  ```

### 6.4 List Document Versions
- **Method**: `GET /api/workspaces/[workspaceId]/pages/[pageId]/versions`
- **Auth**: Any Workspace Member
- **Response `200 OK`**: Reverse-chronological revision history.

### 6.5 Create Document Version Snapshot
- **Method**: `POST /api/workspaces/[workspaceId]/pages/[pageId]/versions`
- **Auth**: `OWNER`, `ADMIN`, or `EDITOR`
- **Request Body**:
  ```json
  { "content": "{\"type\":\"doc\",\"content\":[...]}" }
  ```
- **Response `201 Created`**: Frozen version snapshot.

### 6.6 Restore Document Version
- **Method**: `POST /api/workspaces/[workspaceId]/pages/[pageId]/versions/[versionId]/restore`
- **Auth**: `OWNER`, `ADMIN`, or `EDITOR`
- **Response `200 OK`**: Restores page content to the selected revision and logs activity.

---

## 7. Spatial Canvas Endpoints

### 7.1 Get Canvas State
- **Method**: `GET /api/workspaces/[workspaceId]/canvas`
- **Auth**: Any Workspace Member
- **Response `200 OK`**:
  ```json
  {
    "canvas": {
      "id": "cnv_1",
      "workspaceId": "ws_1",
      "name": "Spatial Canvas",
      "nodes": [
        {
          "id": "node_1",
          "type": "sticky",
          "x": 200,
          "y": 150,
          "width": 200,
          "height": 200,
          "text": "Sprint Goal: Ship Phase 11",
          "color": "yellow"
        }
      ],
      "viewport": { "x": 0, "y": 0, "zoom": 1.0 },
      "version": 4,
      "updatedAt": "2026-11-02T15:30:00.000Z"
    }
  }
  ```

### 7.2 Save Canvas State (REST Fallback)
- **Method**: `PATCH /api/workspaces/[workspaceId]/canvas`
- **Auth**: `OWNER`, `ADMIN`, or `EDITOR`
- **Request Body**:
  ```json
  {
    "nodes": [...],
    "viewport": { "x": 100, "y": 50, "zoom": 1.25 }
  }
  ```
- **Response `200 OK`**: Updated canvas record.

---

## 8. Real-Time Collaboration & Tokens

### 8.1 Acquire Document Collaboration Token
- **Method**: `GET /api/workspaces/[workspaceId]/pages/[pageId]/collab-token`
- **Auth**: Any Workspace Member
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "wsUrl": "wss://collab.syncspace.app/ws_1:page_1?token=eyJhbGciOiJIUzI1NiIs...",
    "canEdit": true,
    "user": { "id": "usr_1", "name": "Alice", "color": "#8b5cf6" }
  }
  ```

### 8.2 Acquire Canvas Collaboration Token
- **Method**: `GET /api/workspaces/[workspaceId]/canvas/collab-token`
- **Auth**: Any Workspace Member
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "wsUrl": "wss://collab.syncspace.app/ws_1:canvas?token=eyJhbGciOiJIUzI1NiIs...",
    "canEdit": true,
    "user": { "id": "usr_1", "name": "Alice", "color": "#10b981" }
  }
  ```

### 8.3 Collaboration Server Health Check
- **Method**: `GET http://collab-host:1234/health`
- **Auth**: Public
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "SyncSpace Collaboration Server",
    "version": "Phase 7B (Multi-Server Distributed Collaboration)",
    "port": 1234,
    "host": "0.0.0.0",
    "activeRooms": 5,
    "dirtyRooms": 0,
    "uptime": 3600.2,
    "redis": {
      "enabled": true,
      "connected": true
    }
  }
  ```

