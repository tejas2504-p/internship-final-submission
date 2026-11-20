import {
  Point,
  BoundingBox,
  SketchElement,
  SketchElementType,
  SketchboardViewport,
  AlignmentType,
  AlignmentGuide,
} from "@/types/sketchboard";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4.0;
export const ZOOM_STEP = 0.15;

/**
 * Transforms screen container coordinates into canvas world space coordinates.
 */
export function screenToWorld(
  screen: Point,
  viewport: SketchboardViewport
): Point {
  return {
    x: (screen.x - viewport.x) / viewport.zoom,
    y: (screen.y - viewport.y) / viewport.zoom,
  };
}

/**
 * Transforms canvas world coordinates into screen container pixels.
 */
export function worldToScreen(
  world: Point,
  viewport: SketchboardViewport
): Point {
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
  viewport: SketchboardViewport,
  mousePoint: Point,
  nextZoom: number
): SketchboardViewport {
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  if (Math.abs(clampedZoom - viewport.zoom) < 0.001) {
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
 * Generates a unique element ID.
 */
export function generateElementId(prefix: string = "el"): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now()}_${rand}`;
}

/**
 * Converts an array of stroke points into a smooth SVG path definition.
 */
export function pointsToSvgPath(points: Point[]): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Calculates the bounding box of a single element.
 */
export function getElementBoundingBox(el: SketchElement): BoundingBox {
  if (el.type === "PEN" || el.type === "HIGHLIGHTER") {
    if (!el.points || el.points.length === 0) {
      return { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height, width: el.width, height: el.height };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = Math.max(el.strokeWidth, 8);
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  if (el.type === "CONNECTOR" && el.startPoint && el.endPoint) {
    const minX = Math.min(el.startPoint.x, el.endPoint.x) - 10;
    const minY = Math.min(el.startPoint.y, el.endPoint.y) - 10;
    const maxX = Math.max(el.startPoint.x, el.endPoint.x) + 10;
    const maxY = Math.max(el.startPoint.y, el.endPoint.y) + 10;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  const minX = el.x;
  const minY = el.y;
  const maxX = el.x + el.width;
  const maxY = el.y + el.height;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, el.width),
    height: Math.max(1, el.height),
  };
}

/**
 * Calculates the combined bounding box of multiple elements.
 */
export function getElementsBoundingBox(elements: SketchElement[]): BoundingBox | null {
  if (!elements || elements.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of elements) {
    const box = getElementBoundingBox(el);
    if (box.minX < minX) minX = box.minX;
    if (box.minY < minY) minY = box.minY;
    if (box.maxX > maxX) maxX = box.maxX;
    if (box.maxY > maxY) maxY = box.maxY;
  }

  if (minX === Infinity) return null;

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
 * Check if a point is inside or near a stroke/shape.
 */
export function pointInElement(point: Point, element: SketchElement): boolean {
  const box = getElementBoundingBox(element);
  const pad = 12;

  // Broadphase check
  if (
    point.x < box.minX - pad ||
    point.x > box.maxX + pad ||
    point.y < box.minY - pad ||
    point.y > box.maxY + pad
  ) {
    return false;
  }

  // Freehand stroke check
  if (element.type === "PEN" || element.type === "HIGHLIGHTER") {
    if (!element.points || element.points.length === 0) return false;
    const threshold = Math.max(element.strokeWidth / 2 + 8, 12);
    for (let i = 0; i < element.points.length - 1; i++) {
      if (pointNearLineSegment(point, element.points[i], element.points[i + 1], threshold)) {
        return true;
      }
    }
    return false;
  }

  // Connector check
  if (element.type === "CONNECTOR" && element.startPoint && element.endPoint) {
    return pointNearLineSegment(point, element.startPoint, element.endPoint, 12);
  }

  // Line / Arrow check
  if (element.type === "LINE" || element.type === "ARROW") {
    const p1 = { x: element.x, y: element.y };
    const p2 = { x: element.x + element.width, y: element.y + element.height };
    return pointNearLineSegment(point, p1, p2, 12);
  }

  // Circle / Ellipse check
  if (element.type === "CIRCLE" || element.type === "ELLIPSE") {
    const rx = element.width / 2;
    const ry = element.height / 2;
    const cx = element.x + rx;
    const cy = element.y + ry;
    if (rx <= 0 || ry <= 0) return false;
    const normalized = Math.pow(point.x - cx, 2) / Math.pow(rx, 2) + Math.pow(point.y - cy, 2) / Math.pow(ry, 2);
    return normalized <= 1.05;
  }

  // Diamond check
  if (element.type === "DIAMOND") {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const dx = Math.abs(point.x - cx) / (element.width / 2 || 1);
    const dy = Math.abs(point.y - cy) / (element.height / 2 || 1);
    return dx + dy <= 1.05;
  }

  // Polygon check (Triangle by default)
  if (element.type === "POLYGON") {
    const p1 = { x: element.x + element.width / 2, y: element.y };
    const p2 = { x: element.x + element.width, y: element.y + element.height };
    const p3 = { x: element.x, y: element.y + element.height };
    return pointInTriangle(point, p1, p2, p3);
  }

  // Default rectangular hit test (Rectangle, Text, Sticky, Image)
  return (
    point.x >= element.x &&
    point.x <= element.x + element.width &&
    point.y >= element.y &&
    point.y <= element.y + element.height
  );
}

function pointNearLineSegment(p: Point, a: Point, b: Point, threshold: number): boolean {
  const l2 = Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2);
  if (l2 === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y) <= threshold;
  }
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * (b.x - a.x);
  const projY = a.y + t * (b.y - a.y);
  return Math.hypot(p.x - projX, p.y - projY) <= threshold;
}

function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const areaOrig = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
  const area1 = Math.abs((a.x - p.x) * (b.y - p.y) - (b.x - p.x) * (a.y - p.y));
  const area2 = Math.abs((b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y));
  const area3 = Math.abs((c.x - p.x) * (a.y - p.y) - (a.x - p.x) * (c.y - p.y));
  return Math.abs(areaOrig - (area1 + area2 + area3)) <= 1;
}

/**
 * Checks whether an element's bounding box intersects with a selection marquee box.
 */
export function elementIntersectsBox(el: SketchElement, marquee: BoundingBox): boolean {
  const elBox = getElementBoundingBox(el);
  return !(
    elBox.maxX < marquee.minX ||
    elBox.minX > marquee.maxX ||
    elBox.maxY < marquee.minY ||
    elBox.minY > marquee.maxY
  );
}

/**
 * Calculates the viewport needed to fit all elements on screen cleanly.
 */
export function calculateFitToView(
  elements: SketchElement[],
  containerWidth: number,
  containerHeight: number,
  padding: number = 80
): SketchboardViewport {
  if (elements.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, zoom: 1.0 };
  }

  const box = getElementsBoundingBox(elements);
  if (!box || box.width === 0 || box.height === 0) {
    return { x: 0, y: 0, zoom: 1.0 };
  }

  const availableWidth = Math.max(100, containerWidth - padding * 2);
  const availableHeight = Math.max(100, containerHeight - padding * 2);

  const zoomX = availableWidth / box.width;
  const zoomY = availableHeight / box.height;
  const rawZoom = Math.min(zoomX, zoomY, 1.5);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rawZoom));

  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;

  return {
    zoom,
    x: containerWidth / 2 - centerX * zoom,
    y: containerHeight / 2 - centerY * zoom,
  };
}

/**
 * Align elements according to alignment type.
 */
export function alignElements(
  elements: SketchElement[],
  selectedIds: Set<string>,
  type: AlignmentType
): SketchElement[] {
  const selected = elements.filter((el) => selectedIds.has(el.id));
  if (selected.length < 2) return elements;

  const box = getElementsBoundingBox(selected);
  if (!box) return elements;

  return elements.map((el) => {
    if (!selectedIds.has(el.id)) return el;

    let newX = el.x;
    let newY = el.y;

    switch (type) {
      case "left":
        newX = box.minX;
        break;
      case "center":
        newX = box.minX + (box.width - el.width) / 2;
        break;
      case "right":
        newX = box.maxX - el.width;
        break;
      case "top":
        newY = box.minY;
        break;
      case "middle":
        newY = box.minY + (box.height - el.height) / 2;
        break;
      case "bottom":
        newY = box.maxY - el.height;
        break;
      case "distribute-h": {
        // Handled in separate pass below
        break;
      }
      case "distribute-v": {
        // Handled in separate pass below
        break;
      }
    }

    return { ...el, x: Math.round(newX), y: Math.round(newY), updatedAt: Date.now() };
  });
}

/**
 * Distributes elements horizontally or vertically.
 */
export function distributeElements(
  elements: SketchElement[],
  selectedIds: Set<string>,
  direction: "horizontal" | "vertical"
): SketchElement[] {
  const selected = elements.filter((el) => selectedIds.has(el.id));
  if (selected.length < 3) return elements;

  const sorted = [...selected].sort((a, b) =>
    direction === "horizontal" ? a.x - b.x : a.y - b.y
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (direction === "horizontal") {
    const totalSpan = last.x - (first.x + first.width);
    const totalObjectWidths = sorted.slice(1, -1).reduce((acc, el) => acc + el.width, 0);
    const spacing = (totalSpan - totalObjectWidths) / (sorted.length - 1);

    let currentX = first.x + first.width + spacing;
    const positionMap = new Map<string, number>();

    for (let i = 1; i < sorted.length - 1; i++) {
      positionMap.set(sorted[i].id, Math.round(currentX));
      currentX += sorted[i].width + spacing;
    }

    return elements.map((el) => {
      if (positionMap.has(el.id)) {
        return { ...el, x: positionMap.get(el.id)!, updatedAt: Date.now() };
      }
      return el;
    });
  } else {
    const totalSpan = last.y - (first.y + first.height);
    const totalObjectHeights = sorted.slice(1, -1).reduce((acc, el) => acc + el.height, 0);
    const spacing = (totalSpan - totalObjectHeights) / (sorted.length - 1);

    let currentY = first.y + first.height + spacing;
    const positionMap = new Map<string, number>();

    for (let i = 1; i < sorted.length - 1; i++) {
      positionMap.set(sorted[i].id, Math.round(currentY));
      currentY += sorted[i].height + spacing;
    }

    return elements.map((el) => {
      if (positionMap.has(el.id)) {
        return { ...el, y: positionMap.get(el.id)!, updatedAt: Date.now() };
      }
      return el;
    });
  }
}

/**
 * Layering helpers: bring to front, send to back, bring forward, send backward.
 */
export function reorderElements(
  elements: SketchElement[],
  selectedIds: Set<string>,
  action: "front" | "back" | "forward" | "backward"
): SketchElement[] {
  if (selectedIds.size === 0) return elements;

  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  if (action === "front") {
    const maxZ = Math.max(...sorted.map((e) => e.zIndex), 0);
    return elements.map((el) => {
      if (selectedIds.has(el.id)) {
        return { ...el, zIndex: maxZ + 1, updatedAt: Date.now() };
      }
      return el;
    });
  }

  if (action === "back") {
    const minZ = Math.min(...sorted.map((e) => e.zIndex), 0);
    return elements.map((el) => {
      if (selectedIds.has(el.id)) {
        return { ...el, zIndex: minZ - 1, updatedAt: Date.now() };
      }
      return el;
    });
  }

  if (action === "forward") {
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (selectedIds.has(sorted[i].id) && !selectedIds.has(sorted[i + 1].id)) {
        const tempZ = sorted[i].zIndex;
        sorted[i].zIndex = sorted[i + 1].zIndex;
        sorted[i + 1].zIndex = tempZ;
        break;
      }
    }
    return sorted;
  }

  if (action === "backward") {
    for (let i = 1; i < sorted.length; i++) {
      if (selectedIds.has(sorted[i].id) && !selectedIds.has(sorted[i - 1].id)) {
        const tempZ = sorted[i].zIndex;
        sorted[i].zIndex = sorted[i - 1].zIndex;
        sorted[i - 1].zIndex = tempZ;
        break;
      }
    }
    return sorted;
  }

  return elements;
}

/**
 * Creates a default element based on tool type.
 */
export function createDefaultSketchElement(
  type: SketchElementType,
  point: Point,
  options?: Partial<SketchElement>
): SketchElement {
  const now = Date.now();
  const id = generateElementId(type.toLowerCase());

  let specific: Partial<SketchElement> = {};

  switch (type) {
    case "PEN":
      specific = {
        width: 1,
        height: 1,
        strokeColor: "#0f172a",
        strokeWidth: 3,
        fillColor: "transparent",
        points: [point],
      };
      break;

    case "HIGHLIGHTER":
      specific = {
        width: 1,
        height: 1,
        strokeColor: "#facc15",
        strokeWidth: 24,
        fillColor: "transparent",
        opacity: 0.35,
        points: [point],
      };
      break;

    case "STICKY":
      specific = {
        width: 200,
        height: 180,
        strokeColor: "#fed7aa",
        fillColor: "#ffedd5",
        text: "New idea or reminder...",
        fontSize: 16,
        textAlign: "left",
        textColor: "#9a3412",
        authorName: "You",
      };
      break;

    case "TEXT":
      specific = {
        width: 180,
        height: 50,
        strokeColor: "transparent",
        fillColor: "transparent",
        text: "Type something...",
        fontSize: 20,
        textAlign: "left",
        textColor: "#0f172a",
      };
      break;

    case "CONNECTOR":
      specific = {
        strokeColor: "#64748b",
        strokeWidth: 2,
        startPoint: point,
        endPoint: { x: point.x + 120, y: point.y + 80 },
        arrowEnd: true,
      };
      break;

    case "RECTANGLE":
      specific = {
        width: 160,
        height: 100,
        strokeColor: "#0284c7",
        fillColor: "transparent",
      };
      break;

    case "CIRCLE":
    case "ELLIPSE":
      specific = {
        width: 120,
        height: 120,
        strokeColor: "#0284c7",
        fillColor: "transparent",
      };
      break;

    case "DIAMOND":
      specific = {
        width: 140,
        height: 140,
        strokeColor: "#0284c7",
        fillColor: "transparent",
      };
      break;

    case "POLYGON":
      specific = {
        width: 130,
        height: 120,
        sides: 3,
        strokeColor: "#0284c7",
        fillColor: "transparent",
      };
      break;

    case "LINE":
      specific = {
        width: 140,
        height: 0,
        strokeColor: "#0f172a",
        strokeWidth: 2,
      };
      break;

    case "ARROW":
      specific = {
        width: 140,
        height: 0,
        strokeColor: "#0f172a",
        strokeWidth: 2,
        arrowEnd: true,
      };
      break;

    case "IMAGE":
      specific = {
        width: 320,
        height: 240,
        strokeColor: "transparent",
        fillColor: "transparent",
        imageUrl: "",
      };
      break;
  }

  return {
    id,
    type,
    x: Math.round(point.x),
    y: Math.round(point.y),
    width: 140,
    height: 100,
    zIndex: 1,
    strokeColor: "#0284c7",
    fillColor: "transparent",
    strokeWidth: 2,
    strokeStyle: "solid",
    opacity: 1,
    createdAt: now,
    updatedAt: now,
    ...specific,
    ...options,
  };
}

/**
 * Export Sketchboard elements as JSON string.
 */
export function exportToJson(elements: SketchElement[], boardName: string): string {
  const data = {
    version: 1,
    appName: "SyncSpace Sketchboard",
    boardName,
    exportedAt: new Date().toISOString(),
    elements,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Downloads a string as a file on client.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Snap a single coordinate to nearest grid interval.
 */
export function snapToGrid(val: number, step: number = 12): number {
  return Math.round(val / step) * step;
}

/**
 * Calculates smart alignment guides and snap offsets for a dragged bounding box against other elements.
 */
export function calculateAlignmentGuides(
  dragBox: BoundingBox,
  candidateElements: SketchElement[],
  threshold: number = 6
): { snapX: number; snapY: number; guides: AlignmentGuide[] } {
  let snapX = dragBox.minX;
  let snapY = dragBox.minY;
  const guides: AlignmentGuide[] = [];

  const dragCenterX = dragBox.minX + dragBox.width / 2;
  const dragCenterY = dragBox.minY + dragBox.height / 2;
  const dragRight = dragBox.maxX;
  const dragBottom = dragBox.maxY;

  let bestDiffX = threshold + 1;
  let bestDiffY = threshold + 1;

  for (const other of candidateElements) {
    const ob = getElementBoundingBox(other);
    const obCenterX = ob.minX + ob.width / 2;
    const obCenterY = ob.minY + ob.height / 2;

    // --- Vertical Alignments (X-axis) ---
    // 1. Left to Left
    if (Math.abs(dragBox.minX - ob.minX) < bestDiffX) {
      bestDiffX = Math.abs(dragBox.minX - ob.minX);
      snapX = ob.minX;
      guides.length = 0; // Clear weaker X guides
      guides.push({
        type: "vertical",
        position: ob.minX,
        start: Math.min(dragBox.minY, ob.minY) - 10,
        end: Math.max(dragBox.maxY, ob.maxY) + 10,
      });
    }
    // 2. Center to Center
    else if (Math.abs(dragCenterX - obCenterX) < bestDiffX) {
      bestDiffX = Math.abs(dragCenterX - obCenterX);
      snapX = obCenterX - dragBox.width / 2;
      guides.length = 0;
      guides.push({
        type: "vertical",
        position: obCenterX,
        start: Math.min(dragBox.minY, ob.minY) - 10,
        end: Math.max(dragBox.maxY, ob.maxY) + 10,
      });
    }
    // 3. Right to Right
    else if (Math.abs(dragRight - ob.maxX) < bestDiffX) {
      bestDiffX = Math.abs(dragRight - ob.maxX);
      snapX = ob.maxX - dragBox.width;
      guides.length = 0;
      guides.push({
        type: "vertical",
        position: ob.maxX,
        start: Math.min(dragBox.minY, ob.minY) - 10,
        end: Math.max(dragBox.maxY, ob.maxY) + 10,
      });
    }

    // --- Horizontal Alignments (Y-axis) ---
    // 1. Top to Top
    if (Math.abs(dragBox.minY - ob.minY) < bestDiffY) {
      bestDiffY = Math.abs(dragBox.minY - ob.minY);
      snapY = ob.minY;
      guides.push({
        type: "horizontal",
        position: ob.minY,
        start: Math.min(dragBox.minX, ob.minX) - 10,
        end: Math.max(dragBox.maxX, ob.maxX) + 10,
      });
    }
    // 2. Center to Center
    else if (Math.abs(dragCenterY - obCenterY) < bestDiffY) {
      bestDiffY = Math.abs(dragCenterY - obCenterY);
      snapY = obCenterY - dragBox.height / 2;
      guides.push({
        type: "horizontal",
        position: obCenterY,
        start: Math.min(dragBox.minX, ob.minX) - 10,
        end: Math.max(dragBox.maxX, ob.maxX) + 10,
      });
    }
    // 3. Bottom to Bottom
    else if (Math.abs(dragBottom - ob.maxY) < bestDiffY) {
      bestDiffY = Math.abs(dragBottom - ob.maxY);
      snapY = ob.maxY - dragBox.height;
      guides.push({
        type: "horizontal",
        position: ob.maxY,
        start: Math.min(dragBox.minX, ob.minX) - 10,
        end: Math.max(dragBox.maxX, ob.maxX) + 10,
      });
    }
  }

  return { snapX, snapY, guides };
}

/**
 * Parses and validates an exported Sketchboard JSON backup string.
 */
export function parseSketchboardJson(rawString: string): {
  boardName?: string;
  elements: SketchElement[];
} {
  const parsed = JSON.parse(rawString);
  const elementsArray = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.elements)
    ? parsed.elements
    : null;

  if (!elementsArray) {
    throw new Error("Invalid Sketchboard backup: missing elements array");
  }

  const elements: SketchElement[] = elementsArray.map((item: unknown, index: number) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid element object at index ${index}`);
    }
    const raw = item as Record<string, unknown>;
    return {
      id: (typeof raw.id === "string" ? raw.id : null) || generateElementId("imported"),
      type: (raw.type as SketchElementType) || "RECTANGLE",
      x: typeof raw.x === "number" ? raw.x : 0,
      y: typeof raw.y === "number" ? raw.y : 0,
      width: typeof raw.width === "number" ? raw.width : 120,
      height: typeof raw.height === "number" ? raw.height : 80,
      zIndex: typeof raw.zIndex === "number" ? raw.zIndex : 1,
      strokeColor: typeof raw.strokeColor === "string" ? raw.strokeColor : "#0284c7",
      fillColor: typeof raw.fillColor === "string" ? raw.fillColor : "transparent",
      strokeWidth: typeof raw.strokeWidth === "number" ? raw.strokeWidth : 2,
      strokeStyle: (raw.strokeStyle as "solid" | "dashed" | "dotted") || "solid",
      opacity: typeof raw.opacity === "number" ? raw.opacity : 1,
      text: typeof raw.text === "string" ? raw.text : undefined,
      fontSize: typeof raw.fontSize === "number" ? raw.fontSize : undefined,
      textAlign: (raw.textAlign as "left" | "center" | "right") || undefined,
      textColor: typeof raw.textColor === "string" ? raw.textColor : undefined,
      points: raw.points,
      startPoint: raw.startPoint,
      endPoint: raw.endPoint,
      arrowEnd: raw.arrowEnd,
      imageUrl: raw.imageUrl,
      isLocked: Boolean(raw.isLocked),
      groupId: raw.groupId,
      createdAt: raw.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
  });

  return {
    boardName: parsed.boardName || undefined,
    elements,
  };
}

