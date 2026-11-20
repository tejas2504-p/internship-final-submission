-- Performance Optimization Composite Indexes (Phase 11.1)

-- Workspace members by workspace and join date
CREATE INDEX IF NOT EXISTS "workspace_members_workspaceId_createdAt_idx" ON "workspace_members"("workspaceId", "createdAt");

-- Pages by workspace and last updated descending
CREATE INDEX IF NOT EXISTS "pages_workspaceId_updatedAt_idx" ON "pages"("workspaceId", "updatedAt" DESC);

-- Comments by page and creation date ascending
CREATE INDEX IF NOT EXISTS "comments_pageId_createdAt_idx" ON "comments"("pageId", "createdAt" ASC);

-- Document versions by page and creation date descending
CREATE INDEX IF NOT EXISTS "document_versions_pageId_createdAt_idx" ON "document_versions"("pageId", "createdAt" DESC);

-- Workspace invitations by workspace and status
CREATE INDEX IF NOT EXISTS "workspace_invitations_workspaceId_status_idx" ON "workspace_invitations"("workspaceId", "status");

-- Workspace activities by workspace and creation date descending
CREATE INDEX IF NOT EXISTS "workspace_activities_workspaceId_createdAt_idx" ON "workspace_activities"("workspaceId", "createdAt" DESC);

