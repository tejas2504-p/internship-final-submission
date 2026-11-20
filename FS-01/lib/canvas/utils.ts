import {
  CanvasNode,
  CanvasNodeType,
  CanvasViewport,
  CanvasPoint,
  CanvasBoundingBox,
  CanvasColorPreset,
  CANVAS_COLOR_PRESETS,
} from "@/types/canvas";

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3.0;
export const ZOOM_STEP = 0.15;

/**
 * Transforms screen container coordinates into canvas world space coordinates.
 */
export function screenToWorld(
  screen: CanvasPoint,
  viewport: CanvasViewport
): CanvasPoint {
  return {
    x: (screen.x - viewport.x) / viewport.zoom,
    y: (screen.y - viewport.y) / viewport.zoom,
  };
}

/**
 * Transforms canvas world coordinates into screen container pixels.
 */
export function worldToScreen(
  world: CanvasPoint,
  viewport: CanvasViewport
): CanvasPoint {
  return {
    x: world.x * viewport.zoom + viewport.x,
    y: world.y * viewport.zoom + viewport.y,
  };
}

/**
 * Zooms into or out of a specific point on screen (e.g. cursor position),
 * preserving that point's location in world space.
 */
export function zoomAroundPoint(
  viewport: CanvasViewport,
  mousePoint: CanvasPoint,
  nextZoom: number
): CanvasViewport {
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  if (clampedZoom === viewport.zoom) {
    return viewport;
  }

  const factor = clampedZoom / viewport.zoom;
  return {
    zoom: clampedZoom,
    x: mousePoint.x - (mousePoint.x - viewport.x) * factor,
    y: mousePoint.y - (mousePoint.y - viewport.y) * factor,
  };
}

/**
 * Retrieves the matching color preset by id, or falls back to Amber.
 */
export function getColorPreset(colorId?: string): CanvasColorPreset {
  const found = CANVAS_COLOR_PRESETS.find((c) => c.id === colorId);
  return found || CANVAS_COLOR_PRESETS[0];
}

/**
 * Generates a collision-resistant unique node ID.
 */
export function generateNodeId(prefix: string = "node"): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

/**
 * Instantiates a default node with standard dimensions, styles, and initial text.
 */
export function createDefaultNode(
  type: CanvasNodeType,
  worldPos: CanvasPoint,
  workspaceId: string,
  options?: Partial<CanvasNode>
): CanvasNode {
  const now = Date.now();
  const id = options?.id || generateNodeId(type.toLowerCase());

  switch (type) {
    case "STICKY":
      return {
        id,
        workspaceId,
        type: "STICKY",
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
        width: 220,
        height: 180,
        zIndex: options?.zIndex ?? 10,
        content: options?.content ?? "New sticky note...",
        colorId: options?.colorId ?? "amber",
        rotation: (Math.random() * 4 - 2), // Subtle Figma/Notion tilt: -2 to +2 deg
        authorName: options?.authorName,
        createdById: options?.createdById,
        createdAt: now,
        updatedAt: now,
        ...options,
      };

    case "RECTANGLE":
      return {
        id,
        workspaceId,
        type: "RECTANGLE",
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
        width: 200,
        height: 130,
        zIndex: options?.zIndex ?? 5,
        content: options?.content ?? "Rectangle",
        colorId: options?.colorId ?? "sky",
        strokeColor: "#38bdf8",
        createdAt: now,
        updatedAt: now,
        ...options,
      };

    case "CIRCLE":
      return {
        id,
        workspaceId,
        type: "CIRCLE",
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
        width: 160,
        height: 160,
        zIndex: options?.zIndex ?? 5,
        content: options?.content ?? "Circle",
        colorId: options?.colorId ?? "emerald",
        strokeColor: "#34d399",
        createdAt: now,
        updatedAt: now,
        ...options,
      };

    case "TEXT":
      return {
        id,
        workspaceId,
        type: "TEXT",
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
        width: 200,
        height: 60,
        zIndex: options?.zIndex ?? 8,
        content: options?.content ?? "Type something...",
        colorId: options?.colorId ?? "white",
        fontSize: options?.fontSize ?? 16,
        createdAt: now,
        updatedAt: now,
        ...options,
      };

    default:
      return {
        id,
        workspaceId,
        type,
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
        width: 180,
        height: 120,
        zIndex: options?.zIndex ?? 5,
        content: options?.content ?? "",
        colorId: options?.colorId ?? "white",
        createdAt: now,
        updatedAt: now,
        ...options,
      };
  }
}

/**
 * Computes bounding rectangle enclosing all nodes on the canvas.
 */
export function calculateBoundingBox(
  nodes: CanvasNode[]
): CanvasBoundingBox | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (node.x < minX) minX = node.x;
    if (node.y < minY) minY = node.y;
    const right = node.x + node.width;
    const bottom = node.y + node.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculates a viewport translation and zoom that fits all nodes inside the viewport.
 */
export function calculateFitToView(
  nodes: CanvasNode[],
  containerWidth: number,
  containerHeight: number,
  padding: number = 80
): CanvasViewport {
  if (nodes.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, zoom: 1.0 };
  }

  const bbox = calculateBoundingBox(nodes);
  if (!bbox) {
    return { x: 0, y: 0, zoom: 1.0 };
  }

  const availableWidth = Math.max(100, containerWidth - padding * 2);
  const availableHeight = Math.max(100, containerHeight - padding * 2);

  const scaleX = availableWidth / Math.max(bbox.width, 100);
  const scaleY = availableHeight / Math.max(bbox.height, 100);
  const fitZoom = Math.min(Math.min(scaleX, scaleY), 1.5); // Cap at 1.5x zoom
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));

  const centerX = bbox.minX + bbox.width / 2;
  const centerY = bbox.minY + bbox.height / 2;

  return {
    zoom: clampedZoom,
    x: containerWidth / 2 - centerX * clampedZoom,
    y: containerHeight / 2 - centerY * clampedZoom,
  };
}

/**
 * Formats a zoom number (e.g. 1.0) into percentage string (e.g. "100%").
 */
export function formatZoomPercentage(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

