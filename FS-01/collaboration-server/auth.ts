import type { IncomingMessage } from "http";
import { prisma } from "../src/lib/db/prisma";
import { verifyCollabToken } from "../src/lib/collaboration/token";
import { getCollabColor } from "../src/lib/collaboration/color";
import type { CollabClient, RoomIdentifier } from "./types";

export interface AuthSuccess {
  authorized: true;
  clientMeta: Omit<CollabClient, "ws" | "connectedAt">;
  room: RoomIdentifier;
}

export interface AuthFailure {
  authorized: false;
  statusCode: number;
  reason: string;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Parse room identifier from request URL path.
 * Supports: "/{workspaceId}:{pageId}" or "/{pageId}" (fallback)
 */
export function parseRoomFromUrl(urlPath: string): RoomIdentifier | null {
  try {
    const parsed = new URL(urlPath, "http://localhost");
    const rawPath = parsed.pathname.replace(/^\/+/, "");
    if (!rawPath) return null;

    if (rawPath.includes(":")) {
      const parts = rawPath.split(":");
      if (parts.length === 3 && parts[0] && parts[1] === "sketchboard" && parts[2]) {
        return {
          workspaceId: parts[0],
          pageId: parts[2],
          roomName: rawPath,
          entityType: "sketchboard",
        };
      }
      if (parts.length === 2 && parts[0] && parts[1]) {
        const entityType =
          parts[1] === "canvas"
            ? "canvas"
            : parts[1] === "sketchboard"
            ? "sketchboard"
            : "page";
        return {
          workspaceId: parts[0],
          pageId: parts[1],
          roomName: rawPath,
          entityType,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Authenticate incoming WebSocket connection request:
 * 1. Parse room name and verify format
 * 2. Extract and cryptographically verify signed collaboration token
 * 3. Verify page and workspace match the token scope
 * 4. Verify live workspace membership and role in PostgreSQL
 *
 * NOTE: Session cookies, secrets, and raw tokens are NEVER logged.
 */
export async function authenticateCollabRequest(
  req: IncomingMessage
): Promise<AuthResult> {
  if (!req.url) {
    return { authorized: false, statusCode: 4400, reason: "Missing request URL" };
  }

  const room = parseRoomFromUrl(req.url);
  if (!room) {
    return {
      authorized: false,
      statusCode: 4400,
      reason: "Invalid room format. Expected '{workspaceId}:{pageId}'",
    };
  }

  // Extract token from query parameters
  const parsedUrl = new URL(req.url, "http://localhost");
  const token = parsedUrl.searchParams.get("token");

  if (!token) {
    console.warn(`[CollabAuth] Connection rejected: Missing token for room=${room.roomName}`);
    return {
      authorized: false,
      statusCode: 4401,
      reason: "Missing authentication token",
    };
  }

  // Cryptographically verify token
  const payload = verifyCollabToken(token);
  if (!payload) {
    console.warn(`[CollabAuth] Connection rejected: Invalid or expired token for room=${room.roomName}`);
    return {
      authorized: false,
      statusCode: 4401,
      reason: "Invalid or expired token",
    };
  }

  // Verify scope matches the requested room
  if (payload.workspaceId !== room.workspaceId || payload.pageId !== room.pageId) {
    console.warn(
      `[CollabAuth] Security rejection: Token scope mismatch for user=${payload.userId} room=${room.roomName}`
    );
    return {
      authorized: false,
      statusCode: 4403,
      reason: "Token is not authorized for this workspace/page room",
    };
  }

  // Verify database membership and current role in PostgreSQL
  try {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: room.workspaceId,
          userId: payload.userId,
        },
      },
    });

    if (!membership) {
      console.warn(
        `[CollabAuth] Security rejection: User ${payload.userId} is not a member of workspace ${room.workspaceId}`
      );
      return {
        authorized: false,
        statusCode: 4403,
        reason: "User has no membership in this workspace",
      };
    }

    const isCanvas = room.pageId === "canvas" || room.entityType === "canvas";
    const isSketchboard = room.pageId === "sketchboard" || room.entityType === "sketchboard";

    if (isCanvas) {
      // Ensure canvas exists for workspace (upsert guarantees atomic concurrency without logging P2002)
      try {
        await prisma.canvas.upsert({
          where: { workspaceId: room.workspaceId },
          create: {
            workspaceId: room.workspaceId,
            name: "Spatial Canvas",
            nodes: [],
            version: 1,
          },
          update: {},
          select: { id: true },
        });
      } catch {
        // Fallback if upsert encounters any transient issue
      }
    } else if (isSketchboard) {
      // Ensure sketchboard exists for workspace
      try {
        if (room.pageId === "sketchboard") {
          const existing = await prisma.sketchboard.findFirst({
            where: { workspaceId: room.workspaceId },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          });
          if (!existing) {
            await prisma.sketchboard.create({
              data: {
                workspaceId: room.workspaceId,
                name: "Workspace Sketchboard",
                elements: [],
                version: 1,
              },
            });
          }
        } else {
          const board = await prisma.sketchboard.findFirst({
            where: {
              id: room.pageId,
              workspaceId: room.workspaceId,
            },
            select: { id: true },
          });
          if (!board) {
            console.warn(
              `[CollabAuth] Security rejection: Sketchboard ${room.pageId} does not belong to workspace ${room.workspaceId}`
            );
            return {
              authorized: false,
              statusCode: 4404,
              reason: "Sketchboard not found in this workspace",
            };
          }
        }
      } catch {
        // Fallback if upsert encounters any transient issue
      }
    } else {
      // Verify page belongs to this workspace
      const pageRecord = await prisma.page.findFirst({
        where: {
          id: room.pageId,
          workspaceId: room.workspaceId,
        },
        select: { id: true },
      });

      if (!pageRecord) {
        console.warn(
          `[CollabAuth] Security rejection: Page ${room.pageId} does not belong to workspace ${room.workspaceId}`
        );
        return {
          authorized: false,
          statusCode: 4404,
          reason: "Page not found in this workspace",
        };
      }
    }

    const canEdit = membership.role !== "VIEWER" && payload.canEdit;

    return {
      authorized: true,
      clientMeta: {
        userId: payload.userId,
        userName: payload.userName,
        workspaceId: room.workspaceId,
        pageId: room.pageId,
        canEdit,
        role: membership.role,
        color: getCollabColor(payload.userId),
        controlledClientIds: new Set<number>(),
      },
      room,
    };
  } catch (err) {
    console.error("[CollabAuth] Database check error during auth handshake:", err);
    return {
      authorized: false,
      statusCode: 1011,
      reason: "Internal server error during authorization verification",
    };
  }
}
