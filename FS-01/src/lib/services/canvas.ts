import prisma from "@/src/lib/db/prisma";
import { WorkspaceRole } from "@prisma/client";
import { getWorkspaceMembership, WorkspaceError, recordWorkspaceActivity } from "./workspace";
import { CanvasNode, CanvasNodeType, CanvasViewport } from "@/types/canvas";

export const MAX_CANVAS_NODES = 500;
export const MAX_CANVAS_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_NODE_CONTENT_LENGTH = 10000;

const VALID_NODE_TYPES: Set<CanvasNodeType> = new Set([
  "STICKY",
  "RECTANGLE",
  "CIRCLE",
  "TEXT",
  "CONNECTOR",
  "FRAME",
  "DOC_EMBED",
]);

export class CanvasConflictError extends Error {
  constructor(
    message: string,
    public status: number = 409,
    public currentVersion: number = 0,
    public canvasData?: unknown
  ) {
    super(message);
    this.name = "CanvasConflictError";
  }
}

export interface SaveCanvasInput {
  name?: string;
  description?: string;
  nodes: CanvasNode[];
  viewport?: CanvasViewport;
  expectedVersion?: number;
}

export interface CanvasRecordData {
  id: string | null;
  workspaceId: string;
  name: string;
  description: string | null;
  nodes: CanvasNode[];
  viewport: CanvasViewport;
  version: number;
  canEdit: boolean;
  currentUserRole: WorkspaceRole;
  lastSavedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Validates a single canvas node against structural and safety constraints.
 */
export function validateCanvasNode(node: unknown, index: number): CanvasNode {
  if (!node || typeof node !== "object") {
    throw new WorkspaceError(`Invalid canvas node at index ${index}: expected an object.`, 400);
  }

  const raw = node as Record<string, unknown>;

  if (typeof raw.id !== "string" || !raw.id.trim() || raw.id.length > 100) {
    throw new WorkspaceError(`Invalid node id at index ${index}: must be a non-empty string under 100 characters.`, 400);
  }

  if (typeof raw.type !== "string" || !VALID_NODE_TYPES.has(raw.type as CanvasNodeType)) {
    throw new WorkspaceError(`Invalid node type "${raw.type}" at index ${index}.`, 400);
  }

  if (typeof raw.x !== "number" || !Number.isFinite(raw.x) || raw.x < -100000 || raw.x > 100000) {
    throw new WorkspaceError(`Invalid coordinate x at index ${index}: must be a finite number between -100000 and 100000.`, 400);
  }

  if (typeof raw.y !== "number" || !Number.isFinite(raw.y) || raw.y < -100000 || raw.y > 100000) {
    throw new WorkspaceError(`Invalid coordinate y at index ${index}: must be a finite number between -100000 and 100000.`, 400);
  }

  if (typeof raw.width !== "number" || !Number.isFinite(raw.width) || raw.width < 10 || raw.width > 10000) {
    throw new WorkspaceError(`Invalid width at index ${index}: must be between 10 and 10000.`, 400);
  }

  if (typeof raw.height !== "number" || !Number.isFinite(raw.height) || raw.height < 10 || raw.height > 10000) {
    throw new WorkspaceError(`Invalid height at index ${index}: must be between 10 and 10000.`, 400);
  }

  const content = typeof raw.content === "string" ? raw.content : "";
  if (content.length > MAX_NODE_CONTENT_LENGTH) {
    throw new WorkspaceError(`Content of node at index ${index} exceeds maximum limit of ${MAX_NODE_CONTENT_LENGTH} characters.`, 400);
  }

  const colorId = typeof raw.colorId === "string" && raw.colorId.length <= 50 ? raw.colorId : "amber";
  const zIndex = typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex) ? Math.round(raw.zIndex) : 10;
  const rotation = typeof raw.rotation === "number" && Number.isFinite(raw.rotation) ? Math.min(360, Math.max(-360, raw.rotation)) : undefined;
  const fontSize = typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize) ? Math.min(120, Math.max(6, raw.fontSize)) : undefined;
  const authorName = typeof raw.authorName === "string" ? raw.authorName.slice(0, 100) : undefined;
  const strokeColor = typeof raw.strokeColor === "string" ? raw.strokeColor.slice(0, 50) : undefined;
  const textColor = typeof raw.textColor === "string" ? raw.textColor.slice(0, 50) : undefined;

  return {
    id: raw.id,
    workspaceId: typeof raw.workspaceId === "string" ? raw.workspaceId : "",
    type: raw.type as CanvasNodeType,
    x: Math.round(raw.x),
    y: Math.round(raw.y),
    width: Math.round(raw.width),
    height: Math.round(raw.height),
    zIndex,
    content,
    colorId,
    strokeColor,
    textColor,
    fontSize,
    rotation,
    authorName,
    createdById: typeof raw.createdById === "string" ? raw.createdById : undefined,
    createdAt: typeof raw.createdAt === "string" || typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "string" || typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

/**
 * Validates canvas nodes array and enforces limit constraints.
 */
export function validateCanvasNodes(nodes: unknown): CanvasNode[] {
  if (!Array.isArray(nodes)) {
    throw new WorkspaceError("Invalid canvas nodes: expected an array.", 400);
  }

  if (nodes.length > MAX_CANVAS_NODES) {
    throw new WorkspaceError(`Canvas object limit exceeded. Maximum ${MAX_CANVAS_NODES} objects allowed per canvas.`, 400);
  }

  return nodes.map((node, index) => validateCanvasNode(node, index));
}

/**
 * Validates viewport data and clamps zoom within safe limits.
 */
export function validateCanvasViewport(viewport?: unknown): CanvasViewport {
  const defaultViewport: CanvasViewport = { x: 0, y: 0, zoom: 1.0 };
  if (!viewport || typeof viewport !== "object") {
    return defaultViewport;
  }

  const raw = viewport as Record<string, unknown>;
  const x = typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : 0;
  const y = typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : 0;
  const zoom = typeof raw.zoom === "number" && Number.isFinite(raw.zoom) ? Math.min(3.0, Math.max(0.2, raw.zoom)) : 1.0;

  return { x, y, zoom };
}

/**
 * Retrieves the saved canvas state for a workspace, enforcing user authorization.
 */
export async function getCanvasForWorkspace(
  workspaceId: string,
  userId: string
): Promise<CanvasRecordData | null> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    return null;
  }

  const role = membership.role;
  const canEdit = role !== WorkspaceRole.VIEWER;

  const canvas = await prisma.canvas.findUnique({
    where: { workspaceId },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      description: true,
      nodes: true,
      viewport: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      lastSavedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!canvas) {
    return {
      id: null,
      workspaceId,
      name: "Spatial Canvas",
      description: null,
      nodes: [],
      viewport: { x: 0, y: 0, zoom: 1.0 },
      version: 0,
      canEdit,
      currentUserRole: role,
      lastSavedBy: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  // Parse nodes safely from Prisma JSON
  let parsedNodes: CanvasNode[] = [];
  try {
    if (Array.isArray(canvas.nodes)) {
      parsedNodes = canvas.nodes as unknown as CanvasNode[];
    } else if (typeof canvas.nodes === "string") {
      parsedNodes = JSON.parse(canvas.nodes);
    }
  } catch {
    parsedNodes = [];
  }

  const viewport = validateCanvasViewport(canvas.viewport);

  return {
    id: canvas.id,
    workspaceId: canvas.workspaceId,
    name: canvas.name,
    description: canvas.description,
    nodes: parsedNodes,
    viewport,
    version: canvas.version,
    canEdit,
    currentUserRole: role,
    lastSavedBy: canvas.lastSavedBy,
    createdAt: canvas.createdAt.toISOString(),
    updatedAt: canvas.updatedAt.toISOString(),
  };
}

/**
 * Persists canvas objects and metadata with validation, authorization, and concurrency protection.
 */
export async function saveCanvasForWorkspace(
  workspaceId: string,
  userId: string,
  input: SaveCanvasInput
): Promise<CanvasRecordData> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  if (membership.role === WorkspaceRole.VIEWER) {
    throw new WorkspaceError("Viewers have read-only access and cannot modify the canvas.", 403);
  }

  // Validate payload size
  const serialized = JSON.stringify(input);
  if (serialized.length > MAX_CANVAS_PAYLOAD_BYTES) {
    throw new WorkspaceError(`Canvas payload exceeds maximum allowed size of 2MB.`, 400);
  }

  // Validate nodes and viewport
  const validatedNodes = validateCanvasNodes(input.nodes);
  const validatedViewport = validateCanvasViewport(input.viewport);

  // Check for existing canvas and optimistic concurrency conflict
  const existing = await prisma.canvas.findUnique({
    where: { workspaceId },
  });

  if (existing && input.expectedVersion !== undefined) {
    // If incoming expectedVersion is less than database version, a newer save occurred
    if (existing.version > input.expectedVersion) {
      throw new CanvasConflictError(
        `Canvas conflict: current version is ${existing.version}, but incoming save expected version ${input.expectedVersion}. Refresh or reload to synchronize changes.`,
        409,
        existing.version,
        {
          nodes: existing.nodes,
          viewport: existing.viewport,
          version: existing.version,
          updatedAt: existing.updatedAt,
        }
      );
    }
  }

  // Upsert canvas in PostgreSQL
  const saved = existing
    ? await prisma.canvas.update({
        where: { workspaceId },
        data: {
          name: input.name ? input.name.trim().slice(0, 100) : existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          nodes: validatedNodes as unknown as object,
          viewport: validatedViewport as unknown as object,
          version: { increment: 1 },
          lastSavedById: userId,
        },
        include: {
          lastSavedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })
    : await prisma.canvas.create({
        data: {
          workspaceId,
          name: input.name ? input.name.trim().slice(0, 100) : "Spatial Canvas",
          description: input.description,
          nodes: validatedNodes as unknown as object,
          viewport: validatedViewport as unknown as object,
          version: 1,
          lastSavedById: userId,
        },
        include: {
          lastSavedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

  await recordWorkspaceActivity(workspaceId, userId, 'CANVAS_UPDATED', 'canvas', saved.id, { nodeCount: validatedNodes.length, canvasName: saved.name });

  return {
    id: saved.id,
    workspaceId: saved.workspaceId,
    name: saved.name,
    description: saved.description,
    nodes: validatedNodes,
    viewport: validatedViewport,
    version: saved.version,
    canEdit: true,
    currentUserRole: membership.role,
    lastSavedBy: saved.lastSavedBy,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  };
}

