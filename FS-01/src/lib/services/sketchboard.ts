import prisma from "@/src/lib/db/prisma";
import { WorkspaceRole, Prisma } from "@prisma/client";
import { getWorkspaceMembership, WorkspaceError, recordWorkspaceActivity } from "./workspace";
import {
  SketchElement,
  SketchElementType,
  SketchboardViewport,
  GridMode,
  CanvasBgTheme,
  SketchboardSummary,
} from "@/types/sketchboard";

export const MAX_SKETCH_ELEMENTS = 1000;
export const MAX_SKETCH_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_TEXT_LENGTH = 10000;

const VALID_ELEMENT_TYPES: Set<SketchElementType> = new Set([
  "PEN",
  "HIGHLIGHTER",
  "RECTANGLE",
  "CIRCLE",
  "ELLIPSE",
  "LINE",
  "ARROW",
  "DIAMOND",
  "POLYGON",
  "TEXT",
  "STICKY",
  "CONNECTOR",
  "IMAGE",
]);

export class SketchboardConflictError extends Error {
  constructor(
    message: string,
    public status: number = 409,
    public currentVersion: number = 0,
    public sketchboardData?: unknown
  ) {
    super(message);
    this.name = "SketchboardConflictError";
  }
}

export interface SaveSketchboardInput {
  name?: string;
  description?: string;
  elements: SketchElement[];
  viewport?: SketchboardViewport;
  gridMode?: GridMode;
  canvasBg?: CanvasBgTheme;
  expectedVersion?: number;
}

export interface SketchboardRecordData {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  elements: SketchElement[];
  viewport: SketchboardViewport;
  gridMode: GridMode;
  canvasBg: CanvasBgTheme;
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
 * Validates a single sketchboard element against structural and safety constraints.
 */
export function validateSketchElement(el: unknown, index: number): SketchElement {
  if (!el || typeof el !== "object") {
    throw new WorkspaceError(`Invalid sketchboard element at index ${index}: expected an object.`, 400);
  }

  const raw = el as Record<string, unknown>;

  if (typeof raw.id !== "string" || !raw.id.trim() || raw.id.length > 100) {
    throw new WorkspaceError(`Invalid element id at index ${index}: must be a non-empty string under 100 characters.`, 400);
  }

  if (typeof raw.type !== "string" || !VALID_ELEMENT_TYPES.has(raw.type as SketchElementType)) {
    throw new WorkspaceError(`Invalid element type "${raw.type}" at index ${index}.`, 400);
  }

  if (typeof raw.x !== "number" || !Number.isFinite(raw.x) || raw.x < -1000000 || raw.x > 1000000) {
    throw new WorkspaceError(`Invalid coordinate x at index ${index}.`, 400);
  }

  if (typeof raw.y !== "number" || !Number.isFinite(raw.y) || raw.y < -1000000 || raw.y > 1000000) {
    throw new WorkspaceError(`Invalid coordinate y at index ${index}.`, 400);
  }

  const width = typeof raw.width === "number" && Number.isFinite(raw.width) ? Math.max(0, raw.width) : 100;
  const height = typeof raw.height === "number" && Number.isFinite(raw.height) ? Math.max(0, raw.height) : 100;
  const zIndex = typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex) ? Math.round(raw.zIndex) : 1;
  const opacity = typeof raw.opacity === "number" && Number.isFinite(raw.opacity) ? Math.max(0.05, Math.min(1, raw.opacity)) : 1;
  const strokeWidth = typeof raw.strokeWidth === "number" && Number.isFinite(raw.strokeWidth) ? Math.max(1, Math.min(64, raw.strokeWidth)) : 2;

  const strokeColor = typeof raw.strokeColor === "string" && raw.strokeColor.length <= 50 ? raw.strokeColor : "#0284c7";
  const fillColor = typeof raw.fillColor === "string" && raw.fillColor.length <= 50 ? raw.fillColor : "transparent";
  const strokeStyle = raw.strokeStyle === "dashed" || raw.strokeStyle === "dotted" ? raw.strokeStyle : "solid";

  const validated: SketchElement = {
    id: raw.id,
    type: raw.type as SketchElementType,
    x: raw.x,
    y: raw.y,
    width,
    height,
    zIndex,
    strokeColor,
    fillColor,
    strokeWidth,
    strokeStyle,
    opacity,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };

  if (typeof raw.isLocked === "boolean") {
    validated.isLocked = raw.isLocked;
  }

  if (typeof raw.groupId === "string" && raw.groupId.length <= 100) {
    validated.groupId = raw.groupId;
  }

  if (typeof raw.rotation === "number" && Number.isFinite(raw.rotation)) {
    validated.rotation = raw.rotation;
  }

  if (typeof raw.text === "string") {
    if (raw.text.length > MAX_TEXT_LENGTH) {
      throw new WorkspaceError(`Text of element at index ${index} exceeds maximum limit of ${MAX_TEXT_LENGTH} characters.`, 400);
    }
    validated.text = raw.text;
  }

  if (typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)) {
    validated.fontSize = Math.max(8, Math.min(128, raw.fontSize));
  }

  if (raw.textAlign === "center" || raw.textAlign === "right") {
    validated.textAlign = raw.textAlign;
  } else {
    validated.textAlign = "left";
  }

  if (typeof raw.textColor === "string" && raw.textColor.length <= 50) {
    validated.textColor = raw.textColor;
  }

  if (typeof raw.authorName === "string" && raw.authorName.length <= 100) {
    validated.authorName = raw.authorName;
  }

  // Points array for PEN & HIGHLIGHTER
  if (Array.isArray(raw.points)) {
    validated.points = raw.points.slice(0, 10000).map((pt: unknown) => {
      const p = pt as { x?: number; y?: number };
      return {
        x: typeof p.x === "number" && Number.isFinite(p.x) ? p.x : 0,
        y: typeof p.y === "number" && Number.isFinite(p.y) ? p.y : 0,
      };
    });
  }

  // Connectors
  if (raw.startPoint && typeof raw.startPoint === "object") {
    const sp = raw.startPoint as { x?: number; y?: number };
    validated.startPoint = {
      x: typeof sp.x === "number" && Number.isFinite(sp.x) ? sp.x : 0,
      y: typeof sp.y === "number" && Number.isFinite(sp.y) ? sp.y : 0,
    };
  }
  if (raw.endPoint && typeof raw.endPoint === "object") {
    const ep = raw.endPoint as { x?: number; y?: number };
    validated.endPoint = {
      x: typeof ep.x === "number" && Number.isFinite(ep.x) ? ep.x : 0,
      y: typeof ep.y === "number" && Number.isFinite(ep.y) ? ep.y : 0,
    };
  }
  if (typeof raw.arrowEnd === "boolean") validated.arrowEnd = raw.arrowEnd;
  if (typeof raw.arrowStart === "boolean") validated.arrowStart = raw.arrowStart;

  // Polygon
  if (typeof raw.sides === "number" && Number.isFinite(raw.sides)) {
    validated.sides = Math.max(3, Math.min(12, raw.sides));
  }

  // Image
  if (typeof raw.imageUrl === "string") {
    validated.imageUrl = raw.imageUrl;
  }

  return validated;
}

/**
 * Lists all sketchboards belonging to a workspace.
 */
export async function listSketchboardsForWorkspace(
  workspaceId: string,
  userId: string
): Promise<SketchboardSummary[]> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("Workspace not found or access denied.", 404);
  }

  const role = membership.role;
  const canEdit = role !== "VIEWER";

  const boards = await prisma.sketchboard.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      description: true,
      elements: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      lastSavedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return boards.map((b) => ({
    id: b.id,
    workspaceId: b.workspaceId,
    name: b.name,
    description: b.description,
    elementsCount: Array.isArray(b.elements) ? b.elements.length : 0,
    version: b.version,
    canEdit,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    createdById: b.createdById,
    lastSavedBy: b.lastSavedBy,
  }));
}

/**
 * Creates a new sketchboard in a workspace.
 */
export async function createSketchboardForWorkspace(
  workspaceId: string,
  userId: string,
  input: { name?: string; description?: string }
): Promise<SketchboardRecordData> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("Workspace not found or access denied.", 404);
  }

  if (membership.role === "VIEWER") {
    throw new WorkspaceError("Viewers have read-only access and cannot create sketchboards.", 403);
  }

  const name = input.name?.trim().slice(0, 100) || "Untitled Sketchboard";

  const record = await prisma.sketchboard.create({
    data: {
      workspaceId,
      name,
      description: input.description,
      elements: [],
      viewport: { x: 0, y: 0, zoom: 1.0 },
      gridMode: "dots",
      canvasBg: "white",
      version: 1,
      createdById: userId,
      lastSavedById: userId,
    },
    include: {
      lastSavedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  try {
    await recordWorkspaceActivity(
      workspaceId,
      userId,
      "SKETCHBOARD_CREATED",
      "sketchboard",
      record.id,
      { name: record.name }
    );
  } catch {}

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    description: record.description,
    elements: [],
    viewport: { x: 0, y: 0, zoom: 1.0 },
    gridMode: "dots",
    canvasBg: "white",
    version: record.version,
    canEdit: true,
    currentUserRole: membership.role,
    lastSavedBy: record.lastSavedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Retrieves a specific sketchboard by ID with permission checks.
 */
export async function getSketchboardById(
  boardId: string,
  userId: string
): Promise<SketchboardRecordData | null> {
  const record = await prisma.sketchboard.findUnique({
    where: { id: boardId },
    include: {
      lastSavedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!record) return null;

  const membership = await getWorkspaceMembership(record.workspaceId, userId);
  if (!membership) return null;

  const elements: SketchElement[] = Array.isArray(record.elements)
    ? (record.elements as unknown[]).map((el, idx) => validateSketchElement(el, idx))
    : [];

  const viewport: SketchboardViewport =
    record.viewport && typeof record.viewport === "object"
      ? (record.viewport as unknown as SketchboardViewport)
      : { x: 0, y: 0, zoom: 1.0 };

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    description: record.description,
    elements,
    viewport,
    gridMode: (record.gridMode as GridMode) || "dots",
    canvasBg: (record.canvasBg as CanvasBgTheme) || "white",
    version: record.version,
    canEdit: membership.role !== "VIEWER",
    currentUserRole: membership.role,
    lastSavedBy: record.lastSavedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Retrieves the primary/latest sketchboard for a workspace (or specific boardId),
 * creating it atomically if not yet initialized.
 */
export async function getSketchboardForWorkspace(
  workspaceId: string,
  userId: string,
  boardId?: string
): Promise<SketchboardRecordData | null> {
  if (boardId) {
    return getSketchboardById(boardId, userId);
  }

  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    return null;
  }

  const role = membership.role;
  const canEdit = role !== "VIEWER";

  // Find existing board in workspace
  let record = await prisma.sketchboard.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: {
      lastSavedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // If no board exists yet, initialize the primary one atomically
  if (!record) {
    record = await prisma.sketchboard.create({
      data: {
        workspaceId,
        name: "Workspace Sketchboard",
        elements: [],
        viewport: { x: 0, y: 0, zoom: 1.0 },
        gridMode: "dots",
        canvasBg: "white",
        version: 1,
        createdById: userId,
        lastSavedById: userId,
      },
      include: {
        lastSavedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  const elements: SketchElement[] = Array.isArray(record.elements)
    ? (record.elements as unknown[]).map((el, idx) => validateSketchElement(el, idx))
    : [];

  const viewport: SketchboardViewport =
    record.viewport && typeof record.viewport === "object"
      ? (record.viewport as unknown as SketchboardViewport)
      : { x: 0, y: 0, zoom: 1.0 };

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    description: record.description,
    elements,
    viewport,
    gridMode: (record.gridMode as GridMode) || "dots",
    canvasBg: (record.canvasBg as CanvasBgTheme) || "white",
    version: record.version,
    canEdit,
    currentUserRole: role,
    lastSavedBy: record.lastSavedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Saves and updates a sketchboard with permission enforcement, validation, and optimistic concurrency.
 */
export async function saveSketchboardForWorkspace(
  workspaceId: string,
  userId: string,
  input: SaveSketchboardInput,
  boardId?: string
): Promise<SketchboardRecordData> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("Workspace not found or access denied.", 404);
  }

  const role = membership.role;
  if (role === "VIEWER") {
    throw new WorkspaceError("Viewers have read-only access and cannot modify the sketchboard.", 403);
  }

  if (!Array.isArray(input.elements)) {
    throw new WorkspaceError("Payload must include an 'elements' array.", 400);
  }

  if (input.elements.length > MAX_SKETCH_ELEMENTS) {
    throw new WorkspaceError(`Sketchboard elements count exceeds maximum limit of ${MAX_SKETCH_ELEMENTS}.`, 400);
  }

  const validatedElements = input.elements.map((el, idx) => validateSketchElement(el, idx));

  const serialized = JSON.stringify(validatedElements);
  if (serialized.length > MAX_SKETCH_PAYLOAD_BYTES) {
    throw new WorkspaceError(`Sketchboard payload exceeds maximum size limit of 5MB.`, 400);
  }

  // Find target board
  let targetId = boardId;
  if (!targetId) {
    const existing = await prisma.sketchboard.findFirst({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, version: true, elements: true },
    });
    if (existing) {
      targetId = existing.id;
      if (typeof input.expectedVersion === "number" && existing.version !== input.expectedVersion) {
        throw new SketchboardConflictError(
          `Version conflict: sketchboard is at version ${existing.version}, expected ${input.expectedVersion}.`,
          409,
          existing.version,
          existing.elements
        );
      }
    }
  } else if (typeof input.expectedVersion === "number") {
    const existing = await prisma.sketchboard.findUnique({
      where: { id: targetId },
      select: { version: true, elements: true },
    });
    if (existing && existing.version !== input.expectedVersion) {
      throw new SketchboardConflictError(
        `Version conflict: sketchboard is at version ${existing.version}, expected ${input.expectedVersion}.`,
        409,
        existing.version,
        existing.elements
      );
    }
  }

  let updatedRecord;
  if (targetId) {
    updatedRecord = await prisma.sketchboard.update({
      where: { id: targetId },
      data: {
        name: input.name ? input.name.trim().slice(0, 100) : undefined,
        description: input.description !== undefined ? input.description : undefined,
        elements: validatedElements as unknown as Prisma.InputJsonValue,
        viewport: input.viewport ? (input.viewport as unknown as Prisma.InputJsonValue) : undefined,
        gridMode: input.gridMode || undefined,
        canvasBg: input.canvasBg || undefined,
        lastSavedById: userId,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
      include: {
        lastSavedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  } else {
    updatedRecord = await prisma.sketchboard.create({
      data: {
        workspaceId,
        name: input.name ? input.name.trim().slice(0, 100) : "Workspace Sketchboard",
        description: input.description,
        elements: validatedElements as unknown as Prisma.InputJsonValue,
        viewport: (input.viewport || { x: 0, y: 0, zoom: 1.0 }) as unknown as Prisma.InputJsonValue,
        gridMode: input.gridMode || "dots",
        canvasBg: input.canvasBg || "white",
        version: 1,
        createdById: userId,
        lastSavedById: userId,
      },
      include: {
        lastSavedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  // Record workspace activity
  try {
    await recordWorkspaceActivity(
      workspaceId,
      userId,
      "SKETCHBOARD_UPDATED",
      "sketchboard",
      updatedRecord.id,
      {
        name: updatedRecord.name,
        elementsCount: validatedElements.length,
        version: updatedRecord.version,
      }
    );
  } catch {}

  return {
    id: updatedRecord.id,
    workspaceId: updatedRecord.workspaceId,
    name: updatedRecord.name,
    description: updatedRecord.description,
    elements: validatedElements,
    viewport: (updatedRecord.viewport as unknown as SketchboardViewport) || { x: 0, y: 0, zoom: 1.0 },
    gridMode: (updatedRecord.gridMode as GridMode) || "dots",
    canvasBg: (updatedRecord.canvasBg as CanvasBgTheme) || "white",
    version: updatedRecord.version,
    canEdit: true,
    currentUserRole: role,
    lastSavedBy: updatedRecord.lastSavedBy,
    createdAt: updatedRecord.createdAt.toISOString(),
    updatedAt: updatedRecord.updatedAt.toISOString(),
  };
}

/**
 * Deletes a sketchboard with role-based access control.
 */
export async function deleteSketchboard(
  boardId: string,
  userId: string
): Promise<{ success: boolean; id: string }> {
  const record = await prisma.sketchboard.findUnique({
    where: { id: boardId },
    select: { id: true, workspaceId: true, name: true, createdById: true },
  });

  if (!record) {
    throw new WorkspaceError("Sketchboard not found.", 404);
  }

  const membership = await getWorkspaceMembership(record.workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("Access denied.", 403);
  }

  const canDelete =
    membership.role === "OWNER" ||
    membership.role === "ADMIN" ||
    record.createdById === userId;

  if (!canDelete) {
    throw new WorkspaceError("You do not have permission to delete this sketchboard.", 403);
  }

  await prisma.sketchboard.delete({
    where: { id: boardId },
  });

  try {
    await recordWorkspaceActivity(
      record.workspaceId,
      userId,
      "SKETCHBOARD_DELETED",
      "sketchboard",
      boardId,
      { name: record.name }
    );
  } catch {}

  return { success: true, id: boardId };
}
