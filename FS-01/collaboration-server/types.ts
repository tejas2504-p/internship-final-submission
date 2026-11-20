import type { WebSocket } from "ws";
import type { CollabColor } from "../src/lib/collaboration/color";

export interface CollabClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  workspaceId: string;
  pageId: string;
  canEdit: boolean;
  role: string;
  color: CollabColor;
  connectedAt: Date;
  controlledClientIds: Set<number>;
}

export interface RoomIdentifier {
  workspaceId: string;
  pageId: string;
  roomName: string;
  entityType?: "page" | "canvas" | "sketchboard";
}
