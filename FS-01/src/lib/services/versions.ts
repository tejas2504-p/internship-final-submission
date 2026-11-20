import prisma from "@/src/lib/db/prisma";
import { WorkspaceRole } from "@prisma/client";
import { getWorkspaceMembership, WorkspaceError } from "./workspace";
import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { prosemirrorJSONToYDoc } from "y-prosemirror";
import type { Schema } from "@tiptap/pm/model";

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

export interface VersionPayload {
  versionPayload: true;
  title: string;
  content: string;
  description?: string;
}

/**
 * Safely serializes document snapshot data (title, rich-text content, description)
 * into the DocumentVersion content field.
 */
export function serializeVersionData(
  title: string,
  content: string,
  description?: string
): string {
  const payload: VersionPayload = {
    versionPayload: true,
    title,
    content,
    description: description?.trim() || undefined,
  };
  return JSON.stringify(payload);
}

/**
 * Deserializes version content, with backward-compatibility for raw unparsed strings.
 */
export function parseVersionData(
  rawContent: string,
  fallbackTitle: string
): {
  title: string;
  content: string;
  description?: string;
} {
  if (!rawContent) {
    return { title: fallbackTitle, content: "" };
  }

  const trimmed = rawContent.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && parsed.versionPayload === true) {
        return {
          title: parsed.title || fallbackTitle,
          content: typeof parsed.content === "string" ? parsed.content : JSON.stringify(parsed.content),
          description: parsed.description,
        };
      }
    } catch {
      // Non-JSON content fallback
    }
  }

  return {
    title: fallbackTitle,
    content: rawContent,
  };
}

/**
 * Fetch all versions for a page within a workspace.
 * Requires workspace membership.
 */
export async function getVersionsForPage(
  workspaceId: string,
  pageId: string,
  userId: string
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    select: { id: true, title: true },
  });

  if (!page) {
    throw new WorkspaceError("Page not found in this workspace.", 404);
  }

  const rawVersions = await prisma.documentVersion.findMany({
    where: { pageId },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rawVersions.map((v) => {
    const parsed = parseVersionData(v.content, page.title);
    return {
      id: v.id,
      pageId: v.pageId,
      title: parsed.title,
      content: parsed.content,
      description: parsed.description,
      createdById: v.createdById,
      createdAt: v.createdAt,
      creator: v.creator,
    };
  });
}

/**
 * Creates a deliberate checkpoint snapshot from the canonical persisted page state.
 * Authorized editors or owners only.
 */
export async function createVersionSnapshot(
  workspaceId: string,
  pageId: string,
  userId: string,
  description?: string
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  if (membership.role === WorkspaceRole.VIEWER) {
    throw new WorkspaceError("Viewers have read-only access and cannot create version snapshots.", 403);
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    select: { id: true, title: true, content: true },
  });

  if (!page) {
    throw new WorkspaceError("Page not found in this workspace.", 404);
  }

  const serialized = serializeVersionData(
    page.title,
    page.content || "",
    description
  );

  const version = await prisma.documentVersion.create({
    data: {
      pageId,
      createdById: userId,
      content: serialized,
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  const parsed = parseVersionData(version.content, page.title);

  return {
    id: version.id,
    pageId: version.pageId,
    title: parsed.title,
    content: parsed.content,
    description: parsed.description,
    createdById: version.createdById,
    createdAt: version.createdAt,
    creator: version.creator,
  };
}

/**
 * Restores an older document version.
 * Requirements:
 * - Allowed only for authorized editors (OWNER, ADMIN, MEMBER).
 * - Creates a new current version rather than deleting historical records.
 * - Safely updates both Page.content and YjsDocument snapshot to keep collaboration state in sync.
 */
export async function restoreVersion(
  workspaceId: string,
  pageId: string,
  versionId: string,
  userId: string
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  if (membership.role === WorkspaceRole.VIEWER) {
    throw new WorkspaceError("Viewers have read-only access and cannot restore versions.", 403);
  }

  // 1. Verify page exists in workspace
  const currentPage = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
  });

  if (!currentPage) {
    throw new WorkspaceError("Page not found in this workspace.", 404);
  }

  // 2. Fetch target historical version
  const targetVersion = await prisma.documentVersion.findFirst({
    where: {
      id: versionId,
      pageId,
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!targetVersion) {
    throw new WorkspaceError("Version not found for this page.", 404);
  }

  const parsedTarget = parseVersionData(targetVersion.content, currentPage.title);
  const restoredTitle = parsedTarget.title;
  const restoredContent = parsedTarget.content;

  // 3. Create a new version record representing the restored state
  // (Ensuring restoration never deletes historical records and records the author + timestamp)
  const targetTimeStr = new Date(targetVersion.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const restoredDescription = parsedTarget.description
    ? `Restored from "${parsedTarget.description}" (${targetTimeStr})`
    : `Restored from version of ${targetTimeStr}`;

  const newVersionSerialized = serializeVersionData(
    restoredTitle,
    restoredContent,
    restoredDescription
  );

  // 4. Derive synchronized Yjs snapshot binary from ProseMirror JSON AST
  let yjsSnapshotBytes: Uint8Array | null = null;
  if (restoredContent) {
    try {
      const raw = restoredContent.trim();
      let parsedJson: Record<string, unknown> | null = null;
      if (raw.startsWith("{") && raw.endsWith("}")) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && (parsed.type === "doc" || parsed.content)) {
          parsedJson = parsed as Record<string, unknown>;
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
      yjsSnapshotBytes = stateUpdate;
      tempDoc.destroy();
    } catch (astErr) {
      console.warn("[RestoreVersion] Non-fatal: Failed to encode Yjs snapshot for restored content:", astErr);
    }
  }

  // 5. Execute atomic transaction to update Page, create new Version, and synchronize Yjs snapshot
  const [newVersion, updatedPage] = await prisma.$transaction(async (tx) => {
    // A. Create new historical checkpoint
    const createdVersion = await tx.documentVersion.create({
      data: {
        pageId,
        createdById: userId,
        content: newVersionSerialized,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // B. Update canonical page title and content
    const pageUpdate = await tx.page.update({
      where: { id: pageId },
      data: {
        title: restoredTitle,
        content: restoredContent,
        updatedAt: new Date(),
      },
    });

    // C. Synchronize yjs_documents binary snapshot if generated
    if (yjsSnapshotBytes) {
      const finalSnapshot = yjsSnapshotBytes as unknown as Uint8Array<ArrayBuffer>;
      await tx.yjsDocument.upsert({
        where: { pageId },
        create: {
          pageId,
          snapshot: finalSnapshot,
        },
        update: {
          snapshot: finalSnapshot,
          updatedAt: new Date(),
        },
      });
    }

    return [createdVersion, pageUpdate];
  });

  const parsedNewVersion = parseVersionData(newVersion.content, updatedPage.title);

  return {
    page: updatedPage,
    newVersion: {
      id: newVersion.id,
      pageId: newVersion.pageId,
      title: parsedNewVersion.title,
      content: parsedNewVersion.content,
      description: parsedNewVersion.description,
      createdById: newVersion.createdById,
      createdAt: newVersion.createdAt,
      creator: newVersion.creator,
    },
  };
}
