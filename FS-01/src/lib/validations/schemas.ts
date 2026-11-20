import { z } from "zod";

/**
 * Zod validation schemas for SyncSpace entities and API requests.
 */

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100, "Name cannot exceed 100 characters"),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
  icon: z.string().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
});

export const createPageSchema = z.object({
  title: z.string().min(1, "Page title is required").max(200, "Title cannot exceed 200 characters"),
  content: z.string().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment content cannot be empty").max(2000, "Comment cannot exceed 2000 characters"),
});

export const updateCanvasSchema = z.object({
  name: z.string().max(100).optional(),
  nodes: z.array(z.record(z.string(), z.unknown())).optional(),
  viewport: z.record(z.string(), z.unknown()).optional(),
});

export const updateSketchboardSchema = z.object({
  name: z.string().max(100).optional(),
  elements: z.array(z.record(z.string(), z.unknown())).optional(),
  viewport: z.record(z.string(), z.unknown()).optional(),
  gridMode: z.enum(["dots", "lines", "none"]).optional(),
  canvasBg: z.enum(["white", "slate", "cream", "dark"]).optional(),
  expectedVersion: z.number().int().positive().optional(),
});
