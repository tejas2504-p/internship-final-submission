-- CreateTable
CREATE TABLE "sketchboards" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Workspace Sketchboard',
    "description" TEXT,
    "elements" JSONB NOT NULL DEFAULT '[]',
    "viewport" JSONB,
    "gridMode" TEXT NOT NULL DEFAULT 'dots',
    "canvasBg" TEXT NOT NULL DEFAULT 'white',
    "yjsSnapshot" BYTEA,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "lastSavedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sketchboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sketchboards_workspaceId_key" ON "sketchboards"("workspaceId");

-- CreateIndex
CREATE INDEX "sketchboards_workspaceId_idx" ON "sketchboards"("workspaceId");

-- CreateIndex
CREATE INDEX "sketchboards_createdById_idx" ON "sketchboards"("createdById");

-- AddForeignKey
ALTER TABLE "sketchboards" ADD CONSTRAINT "sketchboards_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketchboards" ADD CONSTRAINT "sketchboards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketchboards" ADD CONSTRAINT "sketchboards_lastSavedById_fkey" FOREIGN KEY ("lastSavedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

