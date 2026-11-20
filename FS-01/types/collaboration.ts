export interface CursorPosition {
  x: number;
  y: number;
  targetId?: string; // canvas element id or block id
}

export interface AwarenessUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  cursor?: CursorPosition | null;
  activeDocumentId?: string;
  currentAction?: "viewing" | "editing" | "idle" | "dragging";
  lastActive: number;
}

export interface CollaborativeBlock {
  id: string;
  type: string;
  content: unknown;
  version: number;
  lastEditedBy: string;
  lastEditedAt: number;
}

export type RealtimeSyncStatus = "connecting" | "connected" | "disconnected" | "syncing" | "error";
