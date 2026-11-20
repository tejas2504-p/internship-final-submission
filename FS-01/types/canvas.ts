export type CanvasNodeType =
  | "STICKY"
  | "RECTANGLE"
  | "CIRCLE"
  | "TEXT"
  | "CONNECTOR"
  | "FRAME"
  | "DOC_EMBED";

export type CanvasTool =
  | "select"
  | "hand"
  | "sticky"
  | "text"
  | "rectangle"
  | "circle";

export interface CanvasColorPreset {
  id: string;
  name: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  ringClass: string;
  hex: string;
}

export const CANVAS_COLOR_PRESETS: CanvasColorPreset[] = [
  {
    id: "amber",
    name: "Amber",
    bgClass: "bg-amber-100",
    borderClass: "border-amber-300",
    textClass: "text-amber-950",
    ringClass: "ring-amber-400",
    hex: "#fef3c7",
  },
  {
    id: "sky",
    name: "Sky Blue",
    bgClass: "bg-sky-100",
    borderClass: "border-sky-300",
    textClass: "text-sky-950",
    ringClass: "ring-sky-400",
    hex: "#e0f2fe",
  },
  {
    id: "emerald",
    name: "Emerald Green",
    bgClass: "bg-emerald-100",
    borderClass: "border-emerald-300",
    textClass: "text-emerald-950",
    ringClass: "ring-emerald-400",
    hex: "#d1fae5",
  },
  {
    id: "rose",
    name: "Rose Pink",
    bgClass: "bg-rose-100",
    borderClass: "border-rose-300",
    textClass: "text-rose-950",
    ringClass: "ring-rose-400",
    hex: "#ffe4e6",
  },
  {
    id: "violet",
    name: "Violet Purple",
    bgClass: "bg-violet-100",
    borderClass: "border-violet-300",
    textClass: "text-violet-950",
    ringClass: "ring-violet-400",
    hex: "#ede9fe",
  },
  {
    id: "orange",
    name: "Orange",
    bgClass: "bg-orange-100",
    borderClass: "border-orange-300",
    textClass: "text-orange-950",
    ringClass: "ring-orange-400",
    hex: "#ffedd5",
  },
  {
    id: "white",
    name: "Clean White",
    bgClass: "bg-white",
    borderClass: "border-slate-300",
    textClass: "text-slate-900",
    ringClass: "ring-slate-400",
    hex: "#ffffff",
  },
];

export interface CanvasNode {
  id: string;
  workspaceId: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  content: string;
  colorId: string;
  strokeColor?: string;
  textColor?: string;
  fontSize?: number;
  rotation?: number;
  authorName?: string;
  createdById?: string;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number; // 0.2 to 3.0, default 1.0
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type CanvasSaveStatus = "saved" | "saving" | "unsaved" | "error" | "conflict";

export type CollabConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface CanvasCollaborator {
  clientId: number;
  userId: string;
  userName: string;
  color: string;
  role: string;
  canEdit: boolean;
  cursor: CanvasPoint | null; // World coordinates
  selectedNodeId?: string | null;
  lastActive: number;
}

export interface PersistedCanvasData {
  id: string | null;
  workspaceId: string;
  name: string;
  description?: string | null;
  nodes: CanvasNode[];
  viewport?: CanvasViewport;
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

