import prisma from "@/src/lib/db/prisma";
import { WorkspaceRole } from "@prisma/client";
import { getWorkspaceMembership, WorkspaceError } from "./workspace";

/**
 * Validates comment content: trimmed, non-empty, and up to 2000 characters.
 */
export function validateCommentContent(content: unknown): string {
  if (typeof content !== "string") {
    throw new WorkspaceError("Comment content must be text.", 400);
  }
  const trimmed = content.trim();
  if (!trimmed) {
    throw new WorkspaceError("Comment cannot be empty.", 400);
  }
  if (trimmed.length > 2000) {
    throw new WorkspaceError("Comment cannot exceed 2000 characters.", 400);
  }
  return trimmed;
}

/**
 * Fetch all comments for a page within a workspace.
 * Requires user to be a workspace member (OWNER, ADMIN, MEMBER, or VIEWER).
 */
export async function getCommentsForPage(
  workspaceId: string,
  pageId: string,
  userId: string
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  // Ensure page belongs to the workspace
  const page = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    select: { id: true },
  });
  if (!page) {
    throw new WorkspaceError("Page not found in this workspace.", 404);
  }

  const comments = await prisma.comment.findMany({
    where: { pageId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return comments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    pageId: comment.pageId,
    authorId: comment.authorId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.author,
    canDelete:
      comment.authorId === userId ||
      membership.role === WorkspaceRole.OWNER ||
      membership.role === WorkspaceRole.ADMIN,
  }));
}

/**
 * Add a new comment to a page.
 * Viewers have read-only access and cannot post comments.
 */
export async function addCommentToPage(
  workspaceId: string,
  pageId: string,
  userId: string,
  rawContent: unknown
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  if (membership.role === WorkspaceRole.VIEWER) {
    throw new WorkspaceError("Viewers have read-only access and cannot post comments.", 403);
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    select: { id: true },
  });
  if (!page) {
    throw new WorkspaceError("Page not found in this workspace.", 404);
  }

  const content = validateCommentContent(rawContent);

  const comment = await prisma.comment.create({
    data: {
      content,
      pageId,
      authorId: userId,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return {
    ...comment,
    canDelete: true, // author always can delete their own freshly created comment
  };
}

/**
 * Delete a comment from a page.
 * Allowed only for:
 * 1. The original comment author
 * 2. Workspace OWNER or ADMIN
 */
export async function deleteCommentFromPage(
  workspaceId: string,
  pageId: string,
  commentId: string,
  userId: string
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      pageId,
      page: {
        workspaceId,
      },
    },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!comment) {
    throw new WorkspaceError("Comment not found.", 404);
  }

  const isAuthor = comment.authorId === userId;
  const isOwnerOrAdmin =
    membership.role === WorkspaceRole.OWNER ||
    membership.role === WorkspaceRole.ADMIN;

  if (!isAuthor && !isOwnerOrAdmin) {
    throw new WorkspaceError("You do not have permission to delete this comment.", 403);
  }

  return prisma.comment.delete({
    where: { id: commentId },
  });
}
