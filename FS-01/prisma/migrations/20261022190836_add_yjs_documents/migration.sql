-- CreateTable
CREATE TABLE "yjs_documents" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "snapshot" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yjs_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yjs_documents_pageId_key" ON "yjs_documents"("pageId");

-- CreateIndex
CREATE INDEX "yjs_documents_pageId_idx" ON "yjs_documents"("pageId");

-- AddForeignKey
ALTER TABLE "yjs_documents" ADD CONSTRAINT "yjs_documents_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
