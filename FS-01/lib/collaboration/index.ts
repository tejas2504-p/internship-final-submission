import { AwarenessUser, RealtimeSyncStatus } from "@/types";

/**
 * Collaboration architecture foundation for SyncSpace.
 * Real-time CRDT synchronization (Yjs / Liveblocks / WebSockets) scheduled for subsequent phases.
 */

export interface CollaborationRoomConfig {
  roomId: string;
  documentId: string;
  workspaceId: string;
  user: {
    id: string;
    name: string;
    color: string;
  };
}

export interface CollaborationState {
  status: RealtimeSyncStatus;
  activeUsers: AwarenessUser[];
  error?: string | null;
}

/**
 * Generates a distinct pastel color for user presence cursors (Figma-style).
 */
export const COLLABORATION_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export function getRandomUserColor(index?: number): string {
  if (typeof index === "number") {
    return COLLABORATION_COLORS[index % COLLABORATION_COLORS.length];
  }
  return COLLABORATION_COLORS[
    Math.floor(Math.random() * COLLABORATION_COLORS.length)
  ];
}
