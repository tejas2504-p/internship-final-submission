-- DropIndex
DROP INDEX IF EXISTS "sketchboards_workspaceId_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sketchboards_workspaceId_updatedAt_idx" ON "sketchboards"("workspaceId", "updatedAt" DESC);

