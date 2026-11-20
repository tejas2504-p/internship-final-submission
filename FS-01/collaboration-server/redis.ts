import Redis, { type Redis as RedisClient } from "ioredis";

export interface RoomHandlers {
  onUpdate: (update: Uint8Array) => void;
  onAwareness: (awareness: Uint8Array) => void;
  onSyncRequest?: (requesterInstanceId: string, stateVector: Uint8Array) => void;
  onSyncResponse?: (update: Uint8Array, awareness?: Uint8Array) => void;
}

export interface RedisCoordinationAdapter {
  readonly isEnabled: boolean;
  readonly isConnected: boolean;
  subscribeRoom(roomName: string, handlers: RoomHandlers): Promise<void>;
  unsubscribeRoom(roomName: string): Promise<void>;
  publishUpdate(roomName: string, update: Uint8Array): Promise<void>;
  publishAwareness(roomName: string, awareness: Uint8Array): Promise<void>;
  publishSyncResponse(
    roomName: string,
    targetInstanceId: string,
    update: Uint8Array,
    awareness: Uint8Array | null
  ): Promise<void>;
  requestRoomSync(
    roomName: string,
    stateVector: Uint8Array,
    timeoutMs?: number
  ): Promise<{ update: Uint8Array | null; awareness: Uint8Array | null } | null>;
  acquireFlushLock(roomName: string, ttlMs?: number): Promise<boolean>;
  releaseFlushLock(roomName: string): Promise<void>;
  disconnect(): Promise<void>;
}

export interface RedisAdapterOptions {
  redisUrl?: string;
  enabled?: boolean;
  prefix?: string;
  publisher?: RedisClient;
  subscriber?: RedisClient;
}

/**
 * Safely masks credentials from Redis connection URLs for logging without leaking secrets.
 */
export function maskRedisUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = "******";
    if (url.username) url.username = "******";
    return url.toString();
  } catch {
    return rawUrl.replace(/:([^@/]+)@/, ":******@");
  }
}

/**
 * Production Redis Coordination Adapter for SyncSpace.
 * Coordinates binary Yjs CRDT updates, live cursor awareness, distributed database
 * persistence locks, and inter-server room catch-up across multiple collaboration instances.
 */
export class RedisCollabAdapter implements RedisCoordinationAdapter {
  private publisher: RedisClient | null = null;
  private subscriber: RedisClient | null = null;
  private enabled: boolean;
  private prefix: string;
  private connected = false;
  private instanceId: string;

  private roomHandlers = new Map<string, RoomHandlers>();
  private pendingSyncRequests = new Map<
    string,
    (res: { update: Uint8Array | null; awareness: Uint8Array | null }) => void
  >();

  constructor(options: RedisAdapterOptions = {}) {
    const rawUrl = options.redisUrl ?? process.env.REDIS_URL;

    // Explicit options take priority; then REDIS_ENABLED env var; then presence of REDIS_URL
    if (options.enabled !== undefined) {
      this.enabled = options.enabled;
    } else if (options.publisher && options.subscriber) {
      this.enabled = true;
    } else if (process.env.REDIS_ENABLED !== undefined) {
      this.enabled =
        process.env.REDIS_ENABLED === "true" || process.env.REDIS_ENABLED === "1";
    } else {
      this.enabled = Boolean(rawUrl && rawUrl.trim().length > 0);
    }

    this.prefix = options.prefix ?? (process.env.REDIS_KEY_PREFIX || "syncspace:collab:");
    this.instanceId = `instance-${process.pid}-${Math.random().toString(36).substring(2, 8)}`;

    if (!this.enabled) {
      console.log(
        "[CollabRedis] Redis coordination is disabled. Running in standalone single-server mode."
      );
      return;
    }

    // Allow injecting pre-configured clients (e.g. for testing with ioredis-mock)
    if (options.publisher && options.subscriber) {
      this.publisher = options.publisher;
      this.subscriber = options.subscriber;
      this.connected = true;
      this.setupSubscriberDispatch();
      console.log("[CollabRedis] Initialized with custom Redis clients.");
      return;
    }

    const redisUrl = rawUrl || "redis://localhost:6379";
    const maskedUrl = maskRedisUrl(redisUrl);

    let hasLoggedFailure = false;

    const clientConfig = {
      retryStrategy: (times: number) => {
        // If Redis is not available locally, stop retrying after 3 attempts and run cleanly in standalone mode
        if (times > 3) {
          if (!hasLoggedFailure) {
            hasLoggedFailure = true;
            console.log(
              `[CollabRedis] Redis is unreachable at ${maskedUrl}. Running in standalone single-server mode.`
            );
          }
          return null;
        }
        return Math.min(times * 150, 1000);
      },
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
      reconnectOnError: (err: Error) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    };

    try {
      this.publisher = new Redis(redisUrl, clientConfig);
      this.subscriber = new Redis(redisUrl, clientConfig);

      this.publisher.on("ready", () => {
        this.connected = true;
        hasLoggedFailure = false;
        console.log(`[CollabRedis] Publisher ready at ${maskedUrl}.`);
      });

      this.subscriber.on("ready", () => {
        console.log(`[CollabRedis] Subscriber ready at ${maskedUrl}.`);
        this.resubscribeActiveRooms().catch((err) => {
          console.warn("[CollabRedis] Room resubscription error:", err);
        });
      });

      this.publisher.on("error", () => {
        this.connected = false;
        if (!hasLoggedFailure) {
          hasLoggedFailure = true;
          console.log(
            `[CollabRedis] Redis is unavailable at ${maskedUrl}. Running in standalone single-server mode.`
          );
        }
      });

      this.subscriber.on("error", () => {
        this.connected = false;
      });

      this.publisher.on("close", () => {
        if (this.connected) {
          this.connected = false;
          console.log(
            "[CollabRedis] Publisher connection closed. Falling back to local broadcasting."
          );
        }
      });

      this.subscriber.on("close", () => {
        // Silently handled to avoid noise
      });

      this.setupSubscriberDispatch();
    } catch (err: unknown) {
      this.connected = false;
      console.error(
        "[CollabRedis] Failed to initialize Redis connections. Falling back to standalone mode:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Re-subscribe active rooms when subscriber connection recovers.
   */
  private async resubscribeActiveRooms(): Promise<void> {
    if (!this.subscriber || !this.enabled) return;

    for (const roomName of this.roomHandlers.keys()) {
      const updatesCh = this.getUpdatesChannel(roomName);
      const awarenessCh = this.getAwarenessChannel(roomName);
      const syncReqCh = this.getSyncReqChannel(roomName);
      const syncResCh = this.getSyncResChannel(roomName);
      try {
        await this.subscriber.subscribe(updatesCh, awarenessCh, syncReqCh, syncResCh);
      } catch (err) {
        console.warn(
          `[CollabRedis] Failed to resubscribe room ${roomName} after reconnect:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  /**
   * Frames binary payloads with instanceId header to eliminate self-echo reflection.
   * Format: [idLen (1 byte)][instanceId UTF-8][binary payload]
   */
  private frameMessage(payload: Uint8Array): Buffer {
    const idBuf = Buffer.from(this.instanceId, "utf8");
    const idLen = idBuf.length;
    const framed = Buffer.allocUnsafe(1 + idLen + payload.byteLength);
    framed.writeUInt8(idLen, 0);
    idBuf.copy(framed, 1);
    Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).copy(
      framed,
      1 + idLen
    );
    return framed;
  }

  /**
   * Unframes incoming messages. Gracefully falls back to raw unframed buffers for
   * backward compatibility.
   */
  private unframeMessage(
    messageBuf: Buffer
  ): { senderId: string; payload: Uint8Array } | null {
    if (messageBuf.length < 1) return null;
    const idLen = messageBuf.readUInt8(0);
    if (messageBuf.length >= 1 + idLen && idLen > 0) {
      const senderId = messageBuf.toString("utf8", 1, 1 + idLen);
      if (senderId.startsWith("instance-")) {
        const payloadBuf = messageBuf.subarray(1 + idLen);
        const payload = new Uint8Array(
          payloadBuf.buffer,
          payloadBuf.byteOffset,
          payloadBuf.byteLength
        );
        return { senderId, payload };
      }
    }

    // Fallback: raw unframed payload
    return {
      senderId: "unknown",
      payload: new Uint8Array(
        messageBuf.buffer,
        messageBuf.byteOffset,
        messageBuf.byteLength
      ),
    };
  }

  private setupSubscriberDispatch(): void {
    if (!this.subscriber) return;

    this.subscriber.on("messageBuffer", (channelBuf: Buffer, messageBuf: Buffer) => {
      const channel = channelBuf.toString();
      const updatesSuffix = ":updates";
      const awarenessSuffix = ":awareness";
      const syncReqSuffix = ":sync:req";
      const syncResPrefix = `${this.prefix}room:`;
      const syncResMid = `:sync:res:${this.instanceId}`;

      if (!channel.startsWith(this.prefix)) return;
      const withoutPrefix = channel.substring(this.prefix.length);

      if (withoutPrefix.endsWith(updatesSuffix)) {
        const unframed = this.unframeMessage(messageBuf);
        if (!unframed || unframed.senderId === this.instanceId) {
          return; // Skip self-published update to prevent echo loops
        }

        const roomName = withoutPrefix.substring(
          "room:".length,
          withoutPrefix.length - updatesSuffix.length
        );
        const handlers = this.roomHandlers.get(roomName);
        if (handlers) {
          handlers.onUpdate(unframed.payload);
        }
      } else if (withoutPrefix.endsWith(awarenessSuffix)) {
        const unframed = this.unframeMessage(messageBuf);
        if (!unframed || unframed.senderId === this.instanceId) {
          return; // Skip self-published awareness
        }

        const roomName = withoutPrefix.substring(
          "room:".length,
          withoutPrefix.length - awarenessSuffix.length
        );
        const handlers = this.roomHandlers.get(roomName);
        if (handlers) {
          handlers.onAwareness(unframed.payload);
        }
      } else if (withoutPrefix.endsWith(syncReqSuffix)) {
        // Inter-server catch-up request: another server just opened this room
        const roomName = withoutPrefix.substring(
          "room:".length,
          withoutPrefix.length - syncReqSuffix.length
        );
        const unframed = this.unframeMessage(messageBuf);
        if (unframed && unframed.senderId !== this.instanceId) {
          const handlers = this.roomHandlers.get(roomName);
          if (handlers?.onSyncRequest) {
            handlers.onSyncRequest(unframed.senderId, unframed.payload);
          }
        }
      } else if (channel.endsWith(syncResMid)) {
        // Inter-server catch-up response targeted directly to this instance
        const roomPart = channel.substring(
          syncResPrefix.length,
          channel.length - syncResMid.length
        );
        const handlers = this.roomHandlers.get(roomPart);

        // Binary unpack: [awarenessLen: 4B uint32BE][awarenessBytes][diffBytes]
        if (messageBuf.length >= 4) {
          const awarenessLen = messageBuf.readUInt32BE(0);
          let awareness: Uint8Array | null = null;
          if (awarenessLen > 0 && messageBuf.length >= 4 + awarenessLen) {
            const aBuf = messageBuf.subarray(4, 4 + awarenessLen);
            awareness = new Uint8Array(aBuf.buffer, aBuf.byteOffset, aBuf.byteLength);
          }
          const dBuf = messageBuf.subarray(4 + awarenessLen);
          const update =
            dBuf.length > 0
              ? new Uint8Array(dBuf.buffer, dBuf.byteOffset, dBuf.byteLength)
              : null;

          // Resolve pending request promise if waiting
          const resolver = this.pendingSyncRequests.get(roomPart);
          if (resolver) {
            this.pendingSyncRequests.delete(roomPart);
            resolver({ update, awareness });
          }

          if (handlers?.onSyncResponse && (update || awareness)) {
            handlers.onSyncResponse(
              update ?? new Uint8Array(0),
              awareness ?? undefined
            );
          }
        }
      }
    });
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private getUpdatesChannel(roomName: string): string {
    return `${this.prefix}room:${roomName}:updates`;
  }

  private getAwarenessChannel(roomName: string): string {
    return `${this.prefix}room:${roomName}:awareness`;
  }

  private getSyncReqChannel(roomName: string): string {
    return `${this.prefix}room:${roomName}:sync:req`;
  }

  private getSyncResChannel(roomName: string): string {
    return `${this.prefix}room:${roomName}:sync:res:${this.instanceId}`;
  }

  async subscribeRoom(roomName: string, handlers: RoomHandlers): Promise<void> {
    this.roomHandlers.set(roomName, handlers);

    if (!this.enabled || !this.connected || !this.subscriber) {
      return;
    }

    const updatesCh = this.getUpdatesChannel(roomName);
    const awarenessCh = this.getAwarenessChannel(roomName);
    const syncReqCh = this.getSyncReqChannel(roomName);
    const syncResCh = this.getSyncResChannel(roomName);

    try {
      await this.subscriber.subscribe(updatesCh, awarenessCh, syncReqCh, syncResCh);
      console.log(`[CollabRedis] Subscribed to Redis channels for room=${roomName}`);
    } catch (err: unknown) {
      console.warn(
        `[CollabRedis] Non-fatal: Failed to subscribe to Redis for room=${roomName}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  async unsubscribeRoom(roomName: string): Promise<void> {
    this.roomHandlers.delete(roomName);
    this.pendingSyncRequests.delete(roomName);

    if (!this.enabled || !this.connected || !this.subscriber) {
      return;
    }

    const updatesCh = this.getUpdatesChannel(roomName);
    const awarenessCh = this.getAwarenessChannel(roomName);
    const syncReqCh = this.getSyncReqChannel(roomName);
    const syncResCh = this.getSyncResChannel(roomName);

    try {
      await this.subscriber.unsubscribe(updatesCh, awarenessCh, syncReqCh, syncResCh);
      console.log(`[CollabRedis] Unsubscribed from Redis channels for room=${roomName}`);
    } catch (err: unknown) {
      console.warn(
        `[CollabRedis] Non-fatal: Failed to unsubscribe from Redis for room=${roomName}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  async publishUpdate(roomName: string, update: Uint8Array): Promise<void> {
    if (!this.enabled || !this.publisher || !this.connected) {
      return;
    }

    const channel = this.getUpdatesChannel(roomName);
    const framed = this.frameMessage(update);

    try {
      await this.publisher.publish(channel, framed);
    } catch (err: unknown) {
      console.warn(
        `[CollabRedis] Non-fatal: Failed to publish update to Redis for room=${roomName}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  async publishAwareness(roomName: string, awareness: Uint8Array): Promise<void> {
    if (!this.enabled || !this.publisher || !this.connected) {
      return;
    }

    const channel = this.getAwarenessChannel(roomName);
    const framed = this.frameMessage(awareness);

    try {
      await this.publisher.publish(channel, framed);
    } catch (err: unknown) {
      console.warn(
        `[CollabRedis] Non-fatal: Failed to publish awareness to Redis for room=${roomName}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Publishes an inter-server sync response targeted to a specific peer instance.
   */
  async publishSyncResponse(
    roomName: string,
    targetInstanceId: string,
    update: Uint8Array,
    awareness: Uint8Array | null
  ): Promise<void> {
    if (!this.enabled || !this.publisher || !this.connected) {
      return;
    }

    const targetChannel = `${this.prefix}room:${roomName}:sync:res:${targetInstanceId}`;
    const awarenessLen = awareness ? awareness.byteLength : 0;
    const diffLen = update ? update.byteLength : 0;
    const buf = Buffer.allocUnsafe(4 + awarenessLen + diffLen);

    buf.writeUInt32BE(awarenessLen, 0);
    if (awareness && awarenessLen > 0) {
      Buffer.from(awareness.buffer, awareness.byteOffset, awarenessLen).copy(buf, 4);
    }
    if (update && diffLen > 0) {
      Buffer.from(update.buffer, update.byteOffset, diffLen).copy(
        buf,
        4 + awarenessLen
      );
    }

    try {
      await this.publisher.publish(targetChannel, buf);
    } catch (err: unknown) {
      console.warn(
        `[CollabRedis] Non-fatal: Failed to publish sync response to ${targetInstanceId}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Request catch-up synchronization from peer servers when opening a room.
   * If a peer server has in-memory uncommitted edits or active awareness, it replies with the diff.
   */
  async requestRoomSync(
    roomName: string,
    stateVector: Uint8Array,
    timeoutMs = 250
  ): Promise<{ update: Uint8Array | null; awareness: Uint8Array | null } | null> {
    if (!this.enabled || !this.publisher || !this.connected) {
      return null;
    }

    const reqChannel = this.getSyncReqChannel(roomName);
    const framedReq = this.frameMessage(stateVector);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingSyncRequests.delete(roomName);
        resolve(null);
      }, timeoutMs);

      this.pendingSyncRequests.set(roomName, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      this.publisher!.publish(reqChannel, framedReq).catch(() => {
        clearTimeout(timer);
        this.pendingSyncRequests.delete(roomName);
        resolve(null);
      });
    });
  }

  /**
   * Acquire distributed persistence lock to ensure only one server flushes
   * room changes to PostgreSQL per debounce cycle.
   */
  async acquireFlushLock(roomName: string, ttlMs: number = 8000): Promise<boolean> {
    if (!this.enabled || !this.publisher || !this.connected) {
      // In standalone mode, local server is always authorized to flush
      return true;
    }

    const lockKey = `${this.prefix}lock:flush:${roomName}`;

    try {
      const result = await this.publisher.set(
        lockKey,
        this.instanceId,
        "PX",
        ttlMs,
        "NX"
      );
      return result === "OK";
    } catch (err: unknown) {
      console.warn(
        `[CollabRedis] Non-fatal: Lock acquisition error for room=${roomName}:`,
        err instanceof Error ? err.message : String(err)
      );
      // Fallback to local persistence if Redis lock fails
      return true;
    }
  }

  async releaseFlushLock(roomName: string): Promise<void> {
    if (!this.enabled || !this.publisher || !this.connected) {
      return;
    }

    const lockKey = `${this.prefix}lock:flush:${roomName}`;

    try {
      // Only delete if held by this instance
      const currentValue = await this.publisher.get(lockKey);
      if (currentValue === this.instanceId) {
        await this.publisher.del(lockKey);
      }
    } catch {
      // TTL will automatically expire lock
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.roomHandlers.clear();
    this.pendingSyncRequests.clear();

    const promises: Promise<unknown>[] = [];
    if (this.subscriber) {
      promises.push(this.subscriber.quit().catch(() => {}));
    }
    if (this.publisher) {
      promises.push(this.publisher.quit().catch(() => {}));
    }

    await Promise.allSettled(promises);
    console.log("[CollabRedis] Disconnected Redis clients cleanly.");
  }
}

// Global default singleton adapter
let defaultAdapter: RedisCollabAdapter | null = null;

export function getRedisAdapter(): RedisCollabAdapter {
  if (!defaultAdapter) {
    defaultAdapter = new RedisCollabAdapter();
  }
  return defaultAdapter;
}
