import "dotenv/config";
import "../src/lib/dns-fallback";
import http from "http";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../src/lib/db/prisma";
import { authenticateCollabRequest } from "./auth";
import { CollabRoom } from "./room";
import { getRedisAdapter } from "./redis";
import { CanvasPersistenceAdapter, SketchboardPersistenceAdapter } from "./persistence";
import type { CollabClient, RoomIdentifier } from "./types";

const portArg =
  process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1] ||
  (process.argv[2] && /^\d+$/.test(process.argv[2]) ? process.argv[2] : undefined);
const PORT = parseInt(portArg || process.env.COLLAB_PORT || process.env.PORT || "1234", 10);
const HOST = process.env.COLLAB_HOST || "0.0.0.0";

const rooms = new Map<string, CollabRoom>();

/**
 * Get or create a CollabRoom for the given room identifier.
 */
async function getOrCreateRoom(room: RoomIdentifier): Promise<CollabRoom> {
  let collabRoom = rooms.get(room.roomName);
  if (!collabRoom) {
    const isCanvas = room.pageId === "canvas" || room.entityType === "canvas";
    const isSketchboard = room.pageId === "sketchboard" || room.entityType === "sketchboard";
    const adapter = isCanvas
      ? new CanvasPersistenceAdapter()
      : isSketchboard
      ? new SketchboardPersistenceAdapter()
      : undefined;
    collabRoom = new CollabRoom(room, adapter);
    rooms.set(room.roomName, collabRoom);
    await collabRoom.initialize();
  }
  return collabRoom;
}

// Create Express application for HTTP routing, metrics, and health checking
const app = express();
app.use(express.json());

app.get(["/health", "/"], (_req, res) => {
  const dirtyCount = Array.from(rooms.values()).filter((r) => r.dirty).length;
  const redis = getRedisAdapter();
  res.json({
    status: "ok",
    service: "SyncSpace Collaboration Server",
    version: "Phase 7B (Multi-Server Distributed Collaboration)",
    framework: "Express",
    port: PORT,
    host: HOST,
    activeRooms: rooms.size,
    dirtyRooms: dirtyCount,
    uptime: process.uptime(),
    redis: {
      enabled: redis.isEnabled,
      connected: redis.isConnected,
    },
  });
});

// Attach WebSocket server to Express HTTP instance
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server with bounded frame size (10MB max to prevent memory DoS)
const wss = new WebSocketServer({
  server,
  maxPayload: 10 * 1024 * 1024,
});

// Track alive status for heartbeat ping-pong
const aliveSockets = new WeakSet<WebSocket>();

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  aliveSockets.add(ws);
  ws.on("pong", () => {
    aliveSockets.add(ws);
  });

  // Synchronously buffer any early incoming messages while async auth and room setup take place
  // Capped at 50 frames to prevent pre-auth buffer exhaustion
  const MAX_EARLY_QUEUE_SIZE = 50;
  const pendingQueue: Uint8Array[] = [];
  let isReady = false;
  let activeRoom: CollabRoom | null = null;

  function toUint8(data: Buffer | ArrayBuffer | Buffer[]): Uint8Array {
    if (Buffer.isBuffer(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (Array.isArray(data)) {
      const buf = Buffer.concat(data);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } else {
      return new Uint8Array(data);
    }
  }

  ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
    const uint8 = toUint8(data);
    if (isReady && activeRoom) {
      activeRoom.handleMessage(ws, uint8);
    } else if (pendingQueue.length < MAX_EARLY_QUEUE_SIZE) {
      pendingQueue.push(uint8);
    }
  });

  (async () => {
    // 1. Authenticate and authorize incoming connection
    const authResult = await authenticateCollabRequest(req);

    if (!authResult.authorized) {
      const closeCode =
        authResult.statusCode >= 1000 && authResult.statusCode <= 4999
          ? authResult.statusCode
          : 1011;
      ws.close(closeCode, authResult.reason);
      return;
    }

    const { clientMeta, room } = authResult;

    try {
      // 2. Retrieve or initialize the collaborative room
      const collabRoom = await getOrCreateRoom(room);
      activeRoom = collabRoom;

      // 3. Register client in room
      const client: CollabClient = {
        ...clientMeta,
        ws,
        connectedAt: new Date(),
      };

      collabRoom.addClient(client);

      // 4. Mark connection ready and drain any buffered early messages (like SyncStep1)
      isReady = true;
      while (pendingQueue.length > 0) {
        const earlyMessage = pendingQueue.shift()!;
        collabRoom.handleMessage(ws, earlyMessage);
      }

      // 5. Handle socket closure and clean room unload
      const onClientDisconnect = async () => {
        aliveSockets.delete(ws);
        collabRoom.removeClient(ws);
        if (collabRoom.clientCount === 0) {
          try {
            await collabRoom.destroy();
          } catch (err) {
            console.error(`[CollabServer] Error during room unload for room=${room.roomName}:`, err);
          }
          rooms.delete(room.roomName);
          console.log(`[CollabServer] Room ${room.roomName} flushed, unsubscribed, and unloaded from active memory.`);
        }
      };

      ws.on("close", onClientDisconnect);
      ws.on("error", (err) => {
        console.error(`[CollabServer] Client socket error in room=${room.roomName}:`, err.message);
        onClientDisconnect();
      });
    } catch (err: unknown) {
      console.error(`[CollabServer] Error setting up client connection for room=${room.roomName}:`, err);
      ws.close(1011, "Internal server error during room setup");
    }
  })();
});

// Periodic heartbeat to clean up dead or zombie client connections
const heartbeatInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (!aliveSockets.has(client)) {
      client.terminate();
      continue;
    }
    aliveSockets.delete(client);
    client.ping();
  }
}, 30000);

// Periodic persistence sweep to ensure dirty documents are persisted even under edge conditions
const periodicFlushInterval = setInterval(async () => {
  for (const room of rooms.values()) {
    if (room.dirty) {
      await room.flush().catch(() => {});
    }
  }
}, 15000);

// Start listening
server.listen(PORT, HOST, () => {
  const redis = getRedisAdapter();
  console.log("=================================================");
  console.log(`SyncSpace Collaboration Server (Phase 7B: Multi-Server Distributed Collaboration)`);
  console.log(`WebSocket listening on: ws://${HOST}:${PORT}`);
  console.log(`Health endpoint:        http://${HOST}:${PORT}/health`);
  console.log(`Instance Port:          ${PORT}`);
  console.log(`Redis coordination:     ${redis.isEnabled ? "ENABLED" : "DISABLED (Standalone)"}`);
  console.log("=================================================");
});

// Graceful shutdown handling
let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[CollabServer] Received ${signal}. Starting graceful shutdown...`);
  clearInterval(heartbeatInterval);
  clearInterval(periodicFlushInterval);

  // 1. Close WebSocket server to reject new connections
  wss.close();
  server.close();

  // 2. Flush all active dirty rooms to PostgreSQL
  console.log(`[CollabServer] Flushing all dirty rooms before exit...`);
  const flushPromises = Array.from(rooms.values()).map(async (room) => {
    try {
      await room.flush();
    } catch (err) {
      console.error(`[CollabServer] Shutdown flush error for room=${room.roomName}:`, err);
    }
  });

  await Promise.allSettled(flushPromises);

  // 3. Gracefully disconnect Redis adapter
  try {
    await getRedisAdapter().disconnect();
  } catch (redisErr) {
    console.error("[CollabServer] Error disconnecting Redis:", redisErr);
  }

  // 4. Gracefully disconnect database client
  await prisma.$disconnect().catch(() => {});
  console.log("[CollabServer] All rooms flushed, Redis disconnected, database disconnected. Exiting cleanly.");
  process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
