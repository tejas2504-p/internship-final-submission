-- CreateTable
CREATE TABLE "canvases" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Spatial Canvas',
    "description" TEXT,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "viewport" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSavedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "canvases_workspaceId_key" ON "canvases"("workspaceId");

-- CreateIndex
CREATE INDEX "canvases_workspaceId_idx" ON "canvases"("workspaceId");

-- AddForeignKey
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_lastSavedById_fkey" FOREIGN KEY ("lastSavedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

