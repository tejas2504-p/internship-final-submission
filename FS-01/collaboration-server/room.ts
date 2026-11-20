import { WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { CollabClient, RoomIdentifier } from "./types";
import { PostgresPersistenceAdapter, type DocumentPersistenceAdapter } from "./persistence";
import { getRedisAdapter, type RedisCoordinationAdapter } from "./redis";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export class CollabRoom {
  public readonly roomName: string;
  public readonly workspaceId: string;
  public readonly pageId: string;
  public readonly doc: Y.Doc;
  public readonly awareness: awarenessProtocol.Awareness;
  public readonly clients: Map<WebSocket, CollabClient>;
  private isInitialized = false;
  private persistenceAdapter: DocumentPersistenceAdapter;
  private redisAdapter: RedisCoordinationAdapter;

  // Persistence batching & reliability state
  private isDirty = false;
  private saveQueued = false;
  private activeSavePromise: Promise<void> | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private maxWaitTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    room: RoomIdentifier,
    persistenceAdapter: DocumentPersistenceAdapter = new PostgresPersistenceAdapter(),
    redisAdapter: RedisCoordinationAdapter = getRedisAdapter()
  ) {
    this.roomName = room.roomName;
    this.workspaceId = room.workspaceId;
    this.pageId = room.pageId;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.clients = new Map();
    this.persistenceAdapter = persistenceAdapter;
    this.redisAdapter = redisAdapter;

    // Listen for updates on the Y.Doc and broadcast to all connected clients
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      this.broadcastUpdate(update, origin);

      // Publish to other server instances via Redis if update originated locally
      if (origin !== "redis" && origin !== "persistence-init") {
        this.redisAdapter.publishUpdate(this.roomName, update).catch(() => {});
      }

      // Only schedule save if the update did not originate from initial DB seeding
      if (origin !== "persistence-init") {
        this.markDirty();
      }
    });

    // Listen for awareness updates and broadcast them to room peers
    this.awareness.on(
      "update",
      (
        {
          added,
          updated,
          removed,
        }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown
      ) => {
        const changedClients = added.concat(updated, removed);
        if (changedClients.length === 0) return;

        const rawAwarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          changedClients
        );

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(encoder, rawAwarenessUpdate);
        const buff = encoding.toUint8Array(encoder);

        for (const [clientWs] of this.clients) {
          if (clientWs !== origin && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(buff);
          }
        }

        // Broadcast to other server instances via Redis if update originated locally
        if (origin !== "redis") {
          this.redisAdapter
            .publishAwareness(this.roomName, rawAwarenessUpdate)
            .catch(() => {});
        }
      }
    );
  }

  /**
   * Initialize document content from PostgreSQL if empty and subscribe to Redis room channels.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      await this.persistenceAdapter.loadDocument(
        this.workspaceId,
        this.pageId,
        this.doc
      );
    } catch (err: unknown) {
      console.error(
        `[CollabRoom] Failed to initialize room ${this.roomName}:`,
        err instanceof Error ? err.message : String(err)
      );
    }

    // Subscribe this room to Redis cross-instance updates, awareness, and catch-up sync
    try {
      await this.redisAdapter.subscribeRoom(this.roomName, {
        onUpdate: (remoteUpdate: Uint8Array) => {
          // Apply update with origin "redis" to update in-memory doc and broadcast locally,
          // without re-publishing to Redis
          Y.applyUpdate(this.doc, remoteUpdate, "redis");
        },
        onAwareness: (remoteAwareness: Uint8Array) => {
          // Apply awareness update with origin "redis" to broadcast to local WebSockets
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            remoteAwareness,
            "redis"
          );
        },
        onSyncRequest: async (requesterInstanceId: string, stateVector: Uint8Array) => {
          try {
            const diff = Y.encodeStateAsUpdate(this.doc, stateVector);
            const activeStates = Array.from(this.awareness.getStates().keys());
            const awarenessPayload =
              activeStates.length > 0
                ? awarenessProtocol.encodeAwarenessUpdate(this.awareness, activeStates)
                : null;
            await this.redisAdapter.publishSyncResponse(
              this.roomName,
              requesterInstanceId,
              diff,
              awarenessPayload
            );
          } catch (syncErr) {
            console.warn(
              `[CollabRoom] Non-fatal: Error servicing sync request for room ${this.roomName}:`,
              syncErr instanceof Error ? syncErr.message : String(syncErr)
            );
          }
        },
        onSyncResponse: (remoteUpdate: Uint8Array, remoteAwareness?: Uint8Array) => {
          if (remoteUpdate && remoteUpdate.byteLength > 0) {
            Y.applyUpdate(this.doc, remoteUpdate, "redis");
          }
          if (remoteAwareness && remoteAwareness.byteLength > 0) {
            awarenessProtocol.applyAwarenessUpdate(
              this.awareness,
              remoteAwareness,
              "redis"
            );
          }
        },
      });

      // Synchronize in-memory uncommitted edits & awareness from peer servers
      if (this.redisAdapter.isEnabled && this.redisAdapter.isConnected) {
        const localStateVector = Y.encodeStateVector(this.doc);
        const syncRes = await this.redisAdapter.requestRoomSync(
          this.roomName,
          localStateVector,
          250
        );
        if (syncRes?.update && syncRes.update.byteLength > 0) {
          Y.applyUpdate(this.doc, syncRes.update, "redis");
          console.log(
            `[CollabRoom] Synced uncommitted peer edits from Redis for room ${this.roomName}`
          );
        }
        if (syncRes?.awareness && syncRes.awareness.byteLength > 0) {
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            syncRes.awareness,
            "redis"
          );
        }
      }
    } catch (err: unknown) {
      console.warn(
        `[CollabRoom] Non-fatal: Redis subscription/sync failed for room ${this.roomName}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Register a new authenticated client in this room.
   */
  addClient(client: CollabClient): void {
    this.clients.set(client.ws, client);
    console.log(
      `[CollabServer] User joined room=${this.roomName} user=${client.userId} role=${client.role} canEdit=${client.canEdit} (active clients: ${this.clients.size})`
    );

    // 1. Send Server Sync Step 1: initiate Yjs document synchronization
    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, this.doc);
    this.sendToClient(client.ws, encoding.toUint8Array(syncEncoder));

    // 2. Send current room awareness states to the newly connected client
    const currentStates = this.awareness.getStates();
    if (currentStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          Array.from(currentStates.keys())
        )
      );
      this.sendToClient(client.ws, encoding.toUint8Array(awarenessEncoder));
    }
  }

  /**
   * Remove client from this room and clear all their presence awareness states.
   */
  removeClient(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      // Clear all awareness clientIDs registered by this connection
      if (client.controlledClientIds.size > 0) {
        awarenessProtocol.removeAwarenessStates(
          this.awareness,
          Array.from(client.controlledClientIds),
          ws
        );
        client.controlledClientIds.clear();
      }

      this.clients.delete(ws);
      console.log(
        `[CollabServer] User left room=${this.roomName} user=${client.userId} (remaining clients: ${this.clients.size})`
      );
    }
  }

  /**
   * Process incoming binary message from a client.
   * Strictly enforces write permissions and authenticated awareness identity.
   */
  handleMessage(ws: WebSocket, message: Uint8Array): void {
    const client = this.clients.get(ws);
    if (!client) {
      ws.close(4403, "Unregistered client");
      return;
    }

    try {
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          // Peek the sync sub-message type without advancing the pointer
          const syncType = decoding.peekVarUint(decoder);

          // WRITE PERMISSION CHECK: Reject write attempts (both incremental updates and syncStep2) from viewers
          if (
            (syncType === syncProtocol.messageYjsUpdate ||
              syncType === syncProtocol.messageYjsSyncStep2) &&
            !client.canEdit
          ) {
            console.warn(
              `[CollabServer] Rejected write attempt: Viewer user=${client.userId} cannot edit room=${this.roomName}`
            );
            return;
          }

          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);

          // Apply update or answer sync query using this ws as transaction origin
          syncProtocol.readSyncMessage(decoder, encoder, this.doc, ws);

          const responseLen = encoding.length(encoder);

          // If readSyncMessage wrote a response (e.g. syncStep2), send it back to the client
          if (responseLen > 1) {
            this.sendToClient(ws, encoding.toUint8Array(encoder));
          }
          break;
        }

        case MESSAGE_AWARENESS: {
          const awarenessUpdate = decoding.readVarUint8Array(decoder);

          // Track which clientIDs belong to this WebSocket connection (bounded to 100 max per frame)
          const tempDecoder = decoding.createDecoder(awarenessUpdate);
          const count = decoding.readVarUint(tempDecoder);
          const safeCount = Math.min(count, 100);
          for (let i = 0; i < safeCount; i++) {
            const cId = decoding.readVarUint(tempDecoder);
            client.controlledClientIds.add(cId);
            decoding.readVarUint(tempDecoder); // clock
            decoding.readVarString(tempDecoder); // state JSON
          }

          // Enforce server-authenticated identity data:
          // Sanitize every state in this update so clients cannot spoof names, roles, or colors
          const sanitizedUpdate = awarenessProtocol.modifyAwarenessUpdate(
            awarenessUpdate,
            (state: Record<string, unknown> | null) => {
              if (state && typeof state === "object") {
                return {
                  ...state,
                  user: {
                    userId: client.userId,
                    userName: client.userName,
                    role: client.role,
                    canEdit: client.canEdit,
                    color: client.color,
                  },
                };
              }
              return state;
            }
          );

          // Apply update and broadcast to other peers in room
          awarenessProtocol.applyAwarenessUpdate(this.awareness, sanitizedUpdate, ws);
          break;
        }

        default:
          break;
      }
    } catch (err: unknown) {
      console.error(
        `[CollabServer] Message decoding error in room=${this.roomName}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Mark room as dirty and schedule debounced batch persistence.
   */
  private markDirty(): void {
    this.isDirty = true;

    // Reset debounce timer on every edit (2 second idle debounce)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flush().catch((err) => {
        console.error(`[CollabRoom] Debounce save failed in room=${this.roomName}:`, err);
      });
    }, 2000);

    // Ensure max wait time is capped under continuous typing (8 seconds max delay)
    if (!this.maxWaitTimer) {
      this.maxWaitTimer = setTimeout(() => {
        this.maxWaitTimer = null;
        this.flush().catch((err) => {
          console.error(`[CollabRoom] Max wait save failed in room=${this.roomName}:`, err);
        });
      }, 8000);
    }
  }

  /**
   * Flush pending document state to PostgreSQL.
   * Handles concurrency, retries upon failure, and ensures zero data loss.
   */
  public async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }

    // If already saving, queue the next save and wait for current to finish
    if (this.activeSavePromise) {
      this.saveQueued = true;
      await this.activeSavePromise;
      if (this.saveQueued) {
        return this.flush();
      }
      return;
    }

    if (!this.isDirty) {
      return;
    }

    this.saveQueued = false;
    this.isDirty = false;
    this.activeSavePromise = (async () => {
      let hasLock = false;
      try {
        hasLock = await this.redisAdapter.acquireFlushLock(this.roomName, 8000);
        if (!hasLock) {
          console.log(
            `[CollabRoom] Persistence flush skipped for room=${this.roomName} (handled by peer server instance).`
          );
          return;
        }

        await this.persistenceAdapter.saveDocument(
          this.workspaceId,
          this.pageId,
          this.doc
        );

        // Clear any pending error retry timer upon success
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = null;
        }

        console.log(
          `[CollabPersistence] Successfully flushed room=${this.roomName} page=${this.pageId} to PostgreSQL.`
        );
      } catch (err: unknown) {
        this.isDirty = true;
        console.error(
          `[CollabPersistence] Persistence failure for room=${this.roomName}:`,
          err instanceof Error ? err.message : String(err)
        );

        // Schedule retry after 5 seconds to ensure changes are not lost
        if (!this.retryTimer) {
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.flush().catch(() => {});
          }, 5000);
        }
        throw err;
      } finally {
        if (hasLock) {
          await this.redisAdapter.releaseFlushLock(this.roomName).catch(() => {});
        }
        this.activeSavePromise = null;
      }
    })();

    await this.activeSavePromise;

    if (this.saveQueued || this.isDirty) {
      return this.flush();
    }
  }

  /**
   * Broadcast an update to all connected peers in this room, excluding the origin client.
   */
  private broadcastUpdate(update: Uint8Array, origin: unknown): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [ws] of this.clients) {
      if (ws !== origin && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, message);
      }
    }
  }

  private sendToClient(ws: WebSocket, message: Uint8Array): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (err) {
        console.error("[CollabServer] Socket send error:", err);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }

  get dirty(): boolean {
    return this.isDirty;
  }

  /**
   * Clean up room resources, timers, and perform final persistence flush.
   */
  async destroy(): Promise<void> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.maxWaitTimer) clearTimeout(this.maxWaitTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);

    if (this.isDirty) {
      await this.flush();
    }
    await this.redisAdapter.unsubscribeRoom(this.roomName).catch(() => {});
    this.awareness.destroy();
    this.doc.destroy();
    this.clients.clear();
  }
}
