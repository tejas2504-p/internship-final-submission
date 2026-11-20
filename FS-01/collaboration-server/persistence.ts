import * as Y from "yjs";
import { prisma } from "../src/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "y-prosemirror";
import type { Schema } from "@tiptap/pm/model";

/**
 * Interface defining the persistence integration boundary for SyncSpace.
 * In Phase 5B, this provides durable binary Yjs snapshot storage and derives
 * synchronized ProseMirror JSON for non-collaborative and legacy views.
 */
export interface DocumentPersistenceAdapter {
  loadDocument(workspaceId: string, pageId: string, targetDoc: Y.Doc): Promise<boolean>;
  saveDocument(workspaceId: string, pageId: string, doc: Y.Doc): Promise<void>;
}

// Reusable server-side compiled ProseMirror schema for Tiptap
let cachedServerSchema: Schema | null = null;

function getServerSchema(): Schema {
  if (!cachedServerSchema) {
    cachedServerSchema = getSchema([
      StarterKit.configure({
        undoRedo: false,
        heading: {
          levels: [1, 2, 3],
        },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
    ]);
  }
  return cachedServerSchema;
}

/**
 * Phase 5B PostgreSQL Persistence Adapter.
 * - Stores binary Yjs state vector and CRDT history in `yjs_documents` table.
 * - Automatically derives and persists synchronized ProseMirror JSON AST to `pages.content`.
 * - Provides seamless fallback and migration from existing JSON documents.
 */
export class PostgresPersistenceAdapter implements DocumentPersistenceAdapter {
  /**
   * Load document state into the target Y.Doc.
   * Checks for an existing Yjs binary snapshot first; falls back to Page.content JSON.
   */
  async loadDocument(
    workspaceId: string,
    pageId: string,
    targetDoc: Y.Doc
  ): Promise<boolean> {
    try {
      // 1. Fetch both persisted Yjs snapshot and page record to reconcile timestamps
      const [yjsDoc, page] = await Promise.all([
        prisma.yjsDocument.findUnique({
          where: { pageId },
          select: { snapshot: true, updatedAt: true },
        }),
        prisma.page.findFirst({
          where: { id: pageId, workspaceId },
          select: { content: true, updatedAt: true },
        }),
      ]);

      // If a binary snapshot exists and page.content was not updated more recently via REST
      if (
        yjsDoc?.snapshot &&
        yjsDoc.snapshot.length > 0 &&
        (!page?.updatedAt || yjsDoc.updatedAt >= page.updatedAt)
      ) {
        Y.applyUpdate(targetDoc, new Uint8Array(yjsDoc.snapshot), "persistence-init");
        return true;
      }

      // 2. Fallback to existing Page content in PostgreSQL (fresh REST save or initial load)
      if (!page?.content) {
        return false;
      }

      const raw = page.content.trim();
      let parsedJson: Record<string, unknown> | null = null;

      if (raw.startsWith("{") && raw.endsWith("}")) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && (parsed.type === "doc" || parsed.content)) {
            parsedJson = parsed as Record<string, unknown>;
          }
        } catch {
          // Non-JSON content
        }
      }

      if (!parsedJson) {
        parsedJson = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: raw ? [{ type: "text", text: raw }] : [],
            },
          ],
        };
      }

      const schema = getServerSchema();
      const tempDoc = prosemirrorJSONToYDoc(schema, parsedJson, "default");
      const stateUpdate = Y.encodeStateAsUpdate(tempDoc);
      Y.applyUpdate(targetDoc, stateUpdate, "persistence-init");
      tempDoc.destroy();

      // Seed initial Yjs document record in PostgreSQL for future boots
      try {
        await prisma.yjsDocument.upsert({
          where: { pageId },
          create: {
            pageId,
            snapshot: Buffer.from(stateUpdate),
          },
          update: {
            snapshot: Buffer.from(stateUpdate),
          },
        });
      } catch (seedErr) {
        console.warn(
          `[CollabPersistence] Non-fatal: Initial yjs_documents seed failed for page=${pageId}:`,
          seedErr instanceof Error ? seedErr.message : String(seedErr)
        );
      }

      return true;
    } catch (err: unknown) {
      console.error(
        `[CollabPersistence] Failed to load document from PostgreSQL for page=${pageId}:`,
        err instanceof Error ? err.message : String(err)
      );
      return false;
    }
  }

  /**
   * Durably save Yjs document state:
   * 1. Compact binary Yjs snapshot into `yjs_documents`.
   * 2. Derived ProseMirror JSON AST into `pages.content`.
   */
  async saveDocument(
    workspaceId: string,
    pageId: string,
    doc: Y.Doc
  ): Promise<void> {
    // Verify page still exists before saving
    const pageExists = await prisma.page.findFirst({
      where: { id: pageId, workspaceId },
      select: { id: true },
    });

    if (!pageExists) {
      console.warn(`[CollabPersistence] Page ${pageId} no longer exists. Skipping persistence.`);
      return;
    }

    const snapshotBytes = Y.encodeStateAsUpdate(doc);

    // Derive ProseMirror JSON AST from Y.Doc for display and legacy compatibility
    const jsonAst = yDocToProsemirrorJSON(doc, "default");
    const serializedContent = JSON.stringify(jsonAst);

    try {
      // Atomic transaction ensuring both binary snapshot and derived JSON AST persist together
      await prisma.$transaction([
        prisma.yjsDocument.upsert({
          where: { pageId },
          create: {
            pageId,
            snapshot: Buffer.from(snapshotBytes),
          },
          update: {
            snapshot: Buffer.from(snapshotBytes),
          },
        }),
        prisma.page.updateMany({
          where: { id: pageId, workspaceId },
          data: {
            content: serializedContent,
            updatedAt: new Date(),
          },
        }),
      ]);
    } catch (err: unknown) {
      const isPrismaError = typeof err === "object" && err !== null && "code" in err;
      if (isPrismaError && (err as { code: string }).code === "P2003") {
        console.warn(`[CollabPersistence] Page ${pageId} was deleted concurrently. Skipping further saves.`);
        return;
      }
      throw err;
    }
  }
}

/**
 * Phase 9C Canvas Persistence Adapter.
 * Provides durable Yjs binary snapshot storage, compaction, and JSON synchronization
 * with PostgreSQL `canvases` table.
 */
export class CanvasPersistenceAdapter implements DocumentPersistenceAdapter {
  async loadDocument(
    workspaceId: string,
    _pageId: string,
    targetDoc: Y.Doc
  ): Promise<boolean> {
    try {
      const canvas = await prisma.canvas.findUnique({
        where: { workspaceId },
        select: { yjsSnapshot: true, nodes: true },
      });

      if (!canvas) {
        return false;
      }

      // 1. If durable binary Yjs snapshot exists, apply binary state update (full CRDT fidelity & compaction)
      if (canvas.yjsSnapshot && canvas.yjsSnapshot.length > 0) {
        Y.applyUpdate(
          targetDoc,
          new Uint8Array(canvas.yjsSnapshot),
          "persistence-init"
        );
        return true;
      }

      // 2. Fallback to existing JSON nodes (for canvases created prior to snapshotting or via REST)
      targetDoc.transact(() => {
        const yNodes = targetDoc.getMap<unknown>("nodes");
        const rawNodes = canvas.nodes;
        if (Array.isArray(rawNodes)) {
          for (const node of rawNodes) {
            if (
              node &&
              typeof node === "object" &&
              "id" in node &&
              typeof (node as { id: unknown }).id === "string"
            ) {
              yNodes.set((node as { id: string }).id, node);
            }
          }
        }
      }, "persistence-init");

      return true;
    } catch (err: unknown) {
      console.error(
        `[CanvasPersistence] Failed to load canvas for workspace=${workspaceId}:`,
        err instanceof Error ? err.message : String(err)
      );
      return false;
    }
  }

  async saveDocument(
    workspaceId: string,
    _pageId: string,
    doc: Y.Doc
  ): Promise<void> {
    try {
      // 1. Generate compacted binary snapshot of the Yjs document state
      const compactedSnapshot = Buffer.from(Y.encodeStateAsUpdate(doc));

      // 2. Extract JSON representation of nodes for REST and previews
      const yNodes = doc.getMap<unknown>("nodes");
      const nodesList: unknown[] = [];
      const seenIds = new Set<string>();

      yNodes.forEach((node) => {
        if (
          node &&
          typeof node === "object" &&
          "id" in node &&
          typeof (node as { id: unknown }).id === "string"
        ) {
          const id = (node as { id: string }).id;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            nodesList.push(node);
          }
        }
      });

      // 3. Atomically upsert both JSON nodes and binary snapshot into PostgreSQL
      await prisma.canvas.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          name: "Spatial Canvas",
          nodes: nodesList as Prisma.InputJsonValue,
          yjsSnapshot: compactedSnapshot,
          version: 1,
        },
        update: {
          nodes: nodesList as Prisma.InputJsonValue,
          yjsSnapshot: compactedSnapshot,
          updatedAt: new Date(),
          version: { increment: 1 },
        },
      });
    } catch (err: unknown) {
      console.error(
        `[CanvasPersistence] Failed to flush canvas for workspace=${workspaceId}:`,
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }
  }
}

/**
 * Sketchboard Persistence Adapter for Real-Time Collaboration.
 * Provides durable Yjs binary snapshot storage, compaction, and JSON synchronization
 * with PostgreSQL `sketchboards` table.
 */
export class SketchboardPersistenceAdapter implements DocumentPersistenceAdapter {
  async loadDocument(
    workspaceId: string,
    pageId: string,
    targetDoc: Y.Doc
  ): Promise<boolean> {
    try {
      let record = null;
      if (pageId && pageId !== "sketchboard") {
        record = await prisma.sketchboard.findFirst({
          where: { id: pageId, workspaceId },
          select: { id: true, yjsSnapshot: true, elements: true },
        });
      } else {
        record = await prisma.sketchboard.findFirst({
          where: { workspaceId },
          orderBy: { updatedAt: "desc" },
          select: { id: true, yjsSnapshot: true, elements: true },
        });
      }

      if (!record) {
        return false;
      }

      // 1. If durable binary Yjs snapshot exists, apply binary state update
      if (record.yjsSnapshot && record.yjsSnapshot.length > 0) {
        Y.applyUpdate(
          targetDoc,
          new Uint8Array(record.yjsSnapshot),
          "persistence-init"
        );
        return true;
      }

      // 2. Fallback to existing JSON elements
      targetDoc.transact(() => {
        const yElements = targetDoc.getMap<unknown>("elements");
        const rawElements = record!.elements;
        if (Array.isArray(rawElements)) {
          for (const el of rawElements) {
            if (
              el &&
              typeof el === "object" &&
              "id" in el &&
              typeof (el as { id: unknown }).id === "string"
            ) {
              yElements.set((el as { id: string }).id, el);
            }
          }
        }
      }, "persistence-init");

      return true;
    } catch (err: unknown) {
      console.error(
        `[SketchboardPersistence] Failed to load sketchboard for workspace=${workspaceId} pageId=${pageId}:`,
        err instanceof Error ? err.message : String(err)
      );
      return false;
    }
  }

  async saveDocument(
    workspaceId: string,
    pageId: string,
    doc: Y.Doc
  ): Promise<void> {
    try {
      // 1. Generate compacted binary snapshot of the Yjs document state
      const compactedSnapshot = Buffer.from(Y.encodeStateAsUpdate(doc));

      // 2. Extract JSON representation of elements
      const yElements = doc.getMap<unknown>("elements");
      const elementsList: unknown[] = [];
      const seenIds = new Set<string>();

      yElements.forEach((el) => {
        if (
          el &&
          typeof el === "object" &&
          "id" in el &&
          typeof (el as { id: unknown }).id === "string"
        ) {
          const id = (el as { id: string }).id;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            elementsList.push(el);
          }
        }
      });

      // 3. Locate target board
      let targetBoardId: string | null = null;
      if (pageId && pageId !== "sketchboard") {
        targetBoardId = pageId;
      } else {
        const existing = await prisma.sketchboard.findFirst({
          where: { workspaceId },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });
        targetBoardId = existing?.id ?? null;
      }

      if (targetBoardId) {
        await prisma.sketchboard.update({
          where: { id: targetBoardId },
          data: {
            elements: elementsList as Prisma.InputJsonValue,
            yjsSnapshot: compactedSnapshot,
            updatedAt: new Date(),
            version: { increment: 1 },
          },
        });
      } else {
        await prisma.sketchboard.create({
          data: {
            workspaceId,
            name: "Workspace Sketchboard",
            elements: elementsList as Prisma.InputJsonValue,
            yjsSnapshot: compactedSnapshot,
            version: 1,
          },
        });
      }
    } catch (err: unknown) {
      console.error(
        `[SketchboardPersistence] Failed to flush sketchboard for workspace=${workspaceId} pageId=${pageId}:`,
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }
  }
}
