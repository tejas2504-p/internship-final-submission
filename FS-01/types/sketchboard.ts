export type SketchboardTool =
  | "select"
  | "hand"
  | "pen"
  | "highlighter"
  | "eraser"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "line"
  | "arrow"
  | "diamond"
  | "polygon"
  | "text"
  | "sticky"
  | "connector"
  | "image";

export type SketchElementType =
  | "PEN"
  | "HIGHLIGHTER"
  | "RECTANGLE"
  | "CIRCLE"
  | "ELLIPSE"
  | "LINE"
  | "ARROW"
  | "DIAMOND"
  | "POLYGON"
  | "TEXT"
  | "STICKY"
  | "CONNECTOR"
  | "IMAGE";

export type StrokeStyle = "solid" | "dashed" | "dotted";
export type GridMode = "dots" | "grid" | "none";
export type CanvasBgTheme = "white" | "cream" | "slate" | "dark";

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface SketchElement {
  id: string;
  type: SketchElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // In degrees (0 - 360)
  zIndex: number;
  groupId?: string;
  isLocked?: boolean; // When locked, element cannot be moved, resized, or deleted

  // Visual styling
  strokeColor: string;
  fillColor: string; // e.g. "transparent" or hex
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number; // 0.1 to 1.0

  // Specific properties
  points?: Point[]; // For PEN & HIGHLIGHTER freehand strokes
  text?: string; // For TEXT & STICKY
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  textColor?: string;
  authorName?: string; // For STICKY badge

  // Connector properties
  startPoint?: Point;
  endPoint?: Point;
  startElementId?: string;
  endElementId?: string;
  arrowStart?: boolean;
  arrowEnd?: boolean;

  // Polygon properties
  sides?: number; // 3 for triangle, 5 for pentagon, 6 for hexagon

  // Image properties
  imageUrl?: string;
  aspectRatio?: number;

  createdAt: number;
  updatedAt: number;
}

export interface SketchboardViewport {
  x: number;
  y: number;
  zoom: number; // 0.1 to 4.0, default 1.0
}

export type ResizeHandle =
  | "tl"
  | "tc"
  | "tr"
  | "mr"
  | "br"
  | "bc"
  | "bl"
  | "ml"
  | "rotate";

export type AlignmentType =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "distribute-h"
  | "distribute-v";

export interface SketchboardColorPreset {
  id: string;
  name: string;
  stroke: string;
  fill: string;
  text: string;
}

export const SKETCH_COLORS = [
  { label: "Black", hex: "#0f172a" },
  { label: "Slate", hex: "#64748b" },
  { label: "Sky Blue", hex: "#0284c7" },
  { label: "Indigo", hex: "#6366f1" },
  { label: "Violet", hex: "#8b5cf6" },
  { label: "Emerald", hex: "#10b981" },
  { label: "Amber", hex: "#f59e0b" },
  { label: "Rose", hex: "#f43f5e" },
  { label: "White", hex: "#ffffff" },
];

export const STICKY_PALETTES = [
  { id: "amber", name: "Amber Note", bg: "#fef3c7", border: "#fde68a", text: "#78350f" },
  { id: "sky", name: "Sky Note", bg: "#e0f2fe", border: "#bae6fd", text: "#0369a1" },
  { id: "emerald", name: "Emerald Note", bg: "#d1fae5", border: "#a7f3d0", text: "#065f46" },
  { id: "rose", name: "Rose Note", bg: "#ffe4e6", border: "#fecdd3", text: "#9f1239" },
  { id: "violet", name: "Violet Note", bg: "#ede9fe", border: "#ddd6fe", text: "#5b21b6" },
  { id: "orange", name: "Orange Note", bg: "#ffedd5", border: "#fed7aa", text: "#9a3412" },
  { id: "white", name: "Clean Note", bg: "#ffffff", border: "#e2e8f0", text: "#1e293b" },
];

export type SketchboardSaveStatus = "saved" | "saving" | "unsaved" | "error" | "conflict";

export type CollabConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface SketchboardCollaborator {
  clientId: number;
  userId: string;
  userName: string;
  color: string;
  role: string;
  canEdit: boolean;
  cursor: Point | null; // World coordinates
  selectedIds?: string[];
  lastActive: number;
}

export interface AlignmentGuide {
  type: "horizontal" | "vertical";
  position: number; // World coord line
  start: number;
  end: number;
}

export interface PersistedSketchboardData {
  id: string | null;
  workspaceId: string;
  name: string;
  description?: string | null;
  elements: SketchElement[];
  viewport?: SketchboardViewport;
  gridMode?: GridMode;
  canvasBg?: CanvasBgTheme;
  version: number;
  canEdit?: boolean;
  currentUserRole?: string;
  lastSavedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SketchboardSummary {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  elementsCount: number;
  version: number;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  lastSavedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

