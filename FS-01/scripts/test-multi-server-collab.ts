import "dotenv/config";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import RedisMock from "ioredis-mock";
import Redis, { type Redis as RedisClient } from "ioredis";
import { CollabRoom } from "../collaboration-server/room";
import { RedisCollabAdapter, maskRedisUrl } from "../collaboration-server/redis";
import type { DocumentPersistenceAdapter } from "../collaboration-server/persistence";
import type { CollabClient } from "../collaboration-server/types";
import { WebSocket } from "ws";

// Helper sleep
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 4000,
  intervalMs = 50
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for condition after ${timeoutMs}ms`);
    }
    await sleep(intervalMs);
  }
}

// In-memory mock persistence adapter for isolated testing (simulates PostgreSQL yjs_documents)
class MockPersistenceAdapter implements DocumentPersistenceAdapter {
  private static sharedSnapshot: Uint8Array | null = null;
  public saveCount = 0;
  public loadCount = 0;

  public static resetShared(): void {
    MockPersistenceAdapter.sharedSnapshot = null;
  }

  async loadDocument(workspaceId: string, pageId: string, doc: Y.Doc): Promise<boolean> {
    this.loadCount++;
    if (!MockPersistenceAdapter.sharedSnapshot) {
      const seedDoc = new Y.Doc();
      const xmlFragment = seedDoc.getXmlFragment("default");
      const p = new Y.XmlElement("paragraph");
      const t = new Y.XmlText(`Initial state for page ${pageId}`);
      p.insert(0, [t]);
      xmlFragment.insert(0, [p]);
      MockPersistenceAdapter.sharedSnapshot = Y.encodeStateAsUpdate(seedDoc);
      seedDoc.destroy();
    }
    Y.applyUpdate(doc, MockPersistenceAdapter.sharedSnapshot, "persistence-init");
    return true;
  }

  async saveDocument(workspaceId: string, pageId: string, doc: Y.Doc): Promise<void> {
    this.saveCount++;
    MockPersistenceAdapter.sharedSnapshot = Y.encodeStateAsUpdate(doc);
  }
}

// Dummy mock WebSocket client
function createMockClient(
  userId: string,
  userName: string,
  role = "MEMBER",
  canEdit = true
): { ws: WebSocket; client: CollabClient; sentMessages: Uint8Array[] } {
  const sentMessages: Uint8Array[] = [];
  let currentReadyState: number = WebSocket.OPEN;

  const mockWs = {
    get readyState() {
      return currentReadyState;
    },
    send: (data: Uint8Array) => {
      sentMessages.push(data);
    },
    close: () => {
      currentReadyState = WebSocket.CLOSED;
    },
  } as unknown as WebSocket;

  const client: CollabClient = {
    ws: mockWs,
    userId,
    userName,
    workspaceId: "ws-test-123",
    pageId: "page-test-456",
    role,
    canEdit,
    color: { name: "Indigo", hex: "#6366f1", bg: "#e0e7ff", text: "#ffffff" },
    connectedAt: new Date(),
    controlledClientIds: new Set<number>(),
  };

  return { ws: mockWs, client, sentMessages };
}

async function runMockCoordinationSuite() {
  console.log("=================================================");
  console.log("SyncSpace Phase 7A: In-Memory Simulated Redis Tests");
  console.log("=================================================\n");

  const testRoom = {
    roomName: "ws-test-123:page-test-456",
    workspaceId: "ws-test-123",
    pageId: "page-test-456",
  };

  MockPersistenceAdapter.resetShared();

  // Setup: Shared Redis mock infrastructure between Server A & B
  console.log("[Setup] Initializing simulated Server Instance A and Server Instance B...");

  const pubClientA = new RedisMock() as unknown as RedisClient;
  const subClientA = new RedisMock() as unknown as RedisClient;
  const pubClientB = new RedisMock() as unknown as RedisClient;
  const subClientB = new RedisMock() as unknown as RedisClient;

  const adapterA = new RedisCollabAdapter({
    publisher: pubClientA,
    subscriber: subClientA,
    prefix: "test:mock:",
  });

  const adapterB = new RedisCollabAdapter({
    publisher: pubClientB,
    subscriber: subClientB,
    prefix: "test:mock:",
  });

  const persistenceA = new MockPersistenceAdapter();
  const persistenceB = new MockPersistenceAdapter();

  const roomA = new CollabRoom(testRoom, persistenceA, adapterA);
  const roomB = new CollabRoom(testRoom, persistenceB, adapterB);

  await roomA.initialize();
  await roomB.initialize();
  await sleep(100);

  console.log("  [PASS] Server A and Server B initialized and subscribed to shared room channels.\n");

  try {
    // Test 1: Cross-Server Yjs CRDT Synchronization (Server A -> Server B)
    console.log("TEST 1: Yjs CRDT Delta Propagation from Server A to Server B");
    const textA = roomA.doc.getText("shared-doc");
    const textB = roomB.doc.getText("shared-doc");

    console.log("  Alice types on Server A: 'Distributed collaboration via Redis Pub/Sub.'");
    textA.insert(0, "Distributed collaboration via Redis Pub/Sub.");

    await waitForCondition(() => textB.toString() === "Distributed collaboration via Redis Pub/Sub.");
    console.log(`  Server B document text: '${textB.toString()}'`);
    console.log("  [PASS] Server A edit seamlessly propagated across Redis to Server B.\n");

    // Test 2: Bi-directional Concurrent Editing & CRDT Convergence
    console.log("TEST 2: Bi-Directional Concurrent CRDT Editing (Server B -> Server A)");
    console.log("  Bob types on Server B: ' [Appended concurrently by Server B]'");
    textB.insert(textB.length, " [Appended concurrently by Server B]");

    await waitForCondition(
      () =>
        textA.toString().endsWith("[Appended concurrently by Server B]") &&
        textA.toString() === textB.toString()
    );

    console.log(`  Server A converged text: '${textA.toString()}'`);
    console.log(`  Server B converged text: '${textB.toString()}'`);
    console.log("  [PASS] Both server instances converged to identical document states.\n");

    // Test 3: Cross-Server Live Cursor Awareness & Presence Synchronization
    console.log("TEST 3: Cross-Server Live Awareness & Presence Synchronization");
    const alice = createMockClient("user-alice-1", "Alice", "OWNER", true);
    roomA.addClient(alice.client);

    const aliceDoc = new Y.Doc();
    const aliceAwareness = new awarenessProtocol.Awareness(aliceDoc);
    aliceAwareness.setLocalState({
      user: {
        userId: "user-alice-1",
        userName: "Alice",
        color: "#6366f1",
      },
      cursor: { line: 4, ch: 18 },
    });
    const aliceClientId = aliceAwareness.clientID;
    alice.client.controlledClientIds.add(aliceClientId);

    const rawAwarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(aliceAwareness, [
      aliceClientId,
    ]);

    awarenessProtocol.applyAwarenessUpdate(roomA.awareness, rawAwarenessUpdate, alice.ws);

    await waitForCondition(() => {
      const state = roomB.awareness.getStates().get(aliceClientId);
      return Boolean(state && state.user && state.user.userName === "Alice");
    });

    const statesOnB = roomB.awareness.getStates();
    console.log(`  States tracked on Server B: ${statesOnB.size}`);
    const aliceStateOnB = statesOnB.get(aliceClientId);
    console.log("  Alice awareness state on Server B:", JSON.stringify(aliceStateOnB));
    console.log("  [PASS] Cursor and user presence synchronized across servers via Redis.\n");

    // Test 4: Awareness Eviction Across Servers on Disconnect
    console.log("TEST 4: Awareness Eviction Across Servers on Disconnect");
    roomA.removeClient(alice.ws);

    await waitForCondition(() => !roomB.awareness.getStates().has(aliceClientId));
    console.log("  Alice state on Server B after disconnect: EVICTED");
    console.log("  [PASS] Disconnected user awareness was cleanly evicted across all servers.\n");

    // Test 5: Distributed Persistence Lock (Preventing Duplicate DB Flushes)
    console.log("TEST 5: Distributed Persistence Lock & Write Coordination");
    textA.insert(0, "[SaveTest] ");
    await sleep(100);

    const acquiredA = await adapterA.acquireFlushLock(testRoom.roomName, 5000);
    console.log(`  Server A acquireFlushLock: ${acquiredA}`);
    if (!acquiredA) {
      throw new Error("Server A failed to acquire primary flush lock!");
    }

    const acquiredB = await adapterB.acquireFlushLock(testRoom.roomName, 5000);
    console.log(`  Server B acquireFlushLock (while held): ${acquiredB}`);
    if (acquiredB) {
      throw new Error("Concurrency hazard! Server B acquired lock while held by Server A!");
    }
    console.log("  [PASS] Server B correctly blocked from concurrent DB persistence write.");

    await adapterA.releaseFlushLock(testRoom.roomName);

    const acquiredBAfterRelease = await adapterB.acquireFlushLock(testRoom.roomName, 5000);
    console.log(`  Server B acquireFlushLock (after release): ${acquiredBAfterRelease}`);
    if (!acquiredBAfterRelease) {
      throw new Error("Server B could not acquire lock after Server A released it!");
    }
    await adapterB.releaseFlushLock(testRoom.roomName);
    console.log("  [PASS] Distributed flush lock coordinates single-writer DB persistence safely.\n");

    // Test 6: Standalone Fallback when Redis is Disabled
    console.log("TEST 6: Standalone Fallback Mode (Redis Disabled / Offline)");
    const standaloneAdapter = new RedisCollabAdapter({ enabled: false });
    console.log(`  Standalone adapter isEnabled: ${standaloneAdapter.isEnabled}`);
    console.log(`  Standalone adapter isConnected: ${standaloneAdapter.isConnected}`);

    const standalonePersistence = new MockPersistenceAdapter();
    const standaloneRoom = new CollabRoom(
      { roomName: "ws-single:p-single", workspaceId: "ws-single", pageId: "p-single" },
      standalonePersistence,
      standaloneAdapter
    );

    await standaloneRoom.initialize();
    const singleText = standaloneRoom.doc.getText("single-test");
    singleText.insert(0, "Solo node operating without Redis");

    await standaloneRoom.flush();
    console.log(`  Standalone save count: ${standalonePersistence.saveCount}`);
    if (standalonePersistence.saveCount !== 1) {
      throw new Error("Standalone room failed to flush to persistence!");
    }
    await standaloneRoom.destroy();
    console.log("  [PASS] Standalone single-server operation is fully functional.\n");

    console.log("=================================================");
    console.log("ALL SIMULATED COORDINATION TESTS PASSED (6/6)!");
    console.log("=================================================\n");

    await roomA.destroy();
    await roomB.destroy();
    await adapterA.disconnect();
    await adapterB.disconnect();
  } catch (err) {
    await roomA.destroy().catch(() => {});
    await roomB.destroy().catch(() => {});
    await adapterA.disconnect().catch(() => {});
    await adapterB.disconnect().catch(() => {});
    throw err;
  }
}

async function runLiveDockerRedisSuite() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const maskedUrl = maskRedisUrl(redisUrl);

  console.log("=================================================");
  console.log(`SyncSpace Phase 7A: Live Redis Test Suite`);
  console.log(`Target: ${maskedUrl}`);
  console.log("=================================================\n");

  // Verify connectivity first
  const probeClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
  let isReachable = false;
  try {
    const pong = await probeClient.ping();
    if (pong === "PONG") {
      isReachable = true;
      console.log(`[RedisProbe] Verified Redis connectivity: PONG (server ready at ${maskedUrl})\n`);
    }
  } catch (probeErr: unknown) {
    console.warn(
      `[RedisProbe] Redis is not reachable at ${maskedUrl}:`,
      probeErr instanceof Error ? probeErr.message : String(probeErr)
    );
  } finally {
    await probeClient.quit().catch(() => {});
  }

  if (!isReachable) {
    console.log("Skipping live Redis suite (Redis instance offline). Simulated suite passed.");
    return;
  }

  const liveRoomName = `ws-live-${Date.now()}:page-live-${Math.random().toString(36).substring(2, 6)}`;
  const liveRoomIdent = {
    roomName: liveRoomName,
    workspaceId: liveRoomName.split(":")[0],
    pageId: liveRoomName.split(":")[1],
  };

  const adapterA = new RedisCollabAdapter({
    redisUrl,
    prefix: "test:live:collab:",
  });

  const adapterB = new RedisCollabAdapter({
    redisUrl,
    prefix: "test:live:collab:",
  });

  // Wait for both adapters to connect
  await waitForCondition(() => adapterA.isConnected && adapterB.isConnected, 5000);
  console.log("  [PASS] Live Server A and Server B adapters connected to Redis 7 container.\n");

  const persistenceA = new MockPersistenceAdapter();
  const persistenceB = new MockPersistenceAdapter();

  const roomA = new CollabRoom(liveRoomIdent, persistenceA, adapterA);
  const roomB = new CollabRoom(liveRoomIdent, persistenceB, adapterB);

  await roomA.initialize();
  await roomB.initialize();
  await sleep(150);

  try {
    // LIVE TEST 1: Delta Propagation over real Redis Pub/Sub
    console.log("LIVE TEST 1: Yjs Delta Propagation over Docker Redis Pub/Sub");
    const docA = roomA.doc.getText("content");
    const docB = roomB.doc.getText("content");

    docA.insert(0, "Live Redis real-time delta propagation.");
    await waitForCondition(() => docB.toString() === "Live Redis real-time delta propagation.");
    console.log(`  Server B document text: '${docB.toString()}'`);
    console.log("  [PASS] Real-time delta successfully transmitted via Docker Redis.\n");

    // LIVE TEST 2: Concurrent Bidirectional Editing
    console.log("LIVE TEST 2: Concurrent Editing & Convergence over Docker Redis");
    docB.insert(docB.length, " [Live concurrent addition from Node B]");
    await waitForCondition(
      () =>
        docA.toString().endsWith("[Live concurrent addition from Node B]") &&
        docA.toString() === docB.toString()
    );
    console.log(`  Node A converged text: '${docA.toString()}'`);
    console.log(`  Node B converged text: '${docB.toString()}'`);
    console.log("  [PASS] Both nodes converged over live Redis.\n");

    // LIVE TEST 3: Awareness Synchronization over real Redis
    console.log("LIVE TEST 3: Awareness Sync over Docker Redis");
    const dana = createMockClient("user-dana-live", "Dana Live", "EDITOR", true);
    roomA.addClient(dana.client);

    const danaDoc = new Y.Doc();
    const danaAwareness = new awarenessProtocol.Awareness(danaDoc);
    danaAwareness.setLocalState({
      user: { userId: "user-dana-live", userName: "Dana Live", color: "#10b981" },
      cursor: { line: 12, ch: 4 },
    });
    const danaClientId = danaAwareness.clientID;
    dana.client.controlledClientIds.add(danaClientId);

    awarenessProtocol.applyAwarenessUpdate(
      roomA.awareness,
      awarenessProtocol.encodeAwarenessUpdate(danaAwareness, [danaClientId]),
      dana.ws
    );

    await waitForCondition(() => {
      const state = roomB.awareness.getStates().get(danaClientId);
      return Boolean(state && state.user && state.user.userName === "Dana Live");
    });
    console.log("  [PASS] User cursor & identity broadcast across live Redis.\n");

    // LIVE TEST 4: Awareness Eviction on Disconnect
    console.log("LIVE TEST 4: Awareness Eviction on Disconnect over Docker Redis");
    roomA.removeClient(dana.ws);
    await waitForCondition(() => !roomB.awareness.getStates().has(danaClientId));
    console.log("  [PASS] User state cleanly evicted from peer node.\n");

    // LIVE TEST 5: Real Redis Distributed Flush Lock (SET NX PX)
    console.log("LIVE TEST 5: Distributed Flush Lock (SET NX PX) on Docker Redis");
    const lockAcquiredA = await adapterA.acquireFlushLock(liveRoomName, 6000);
    console.log(`  Node A acquire lock: ${lockAcquiredA}`);
    if (!lockAcquiredA) throw new Error("Node A failed to acquire live flush lock!");

    const lockAcquiredB = await adapterB.acquireFlushLock(liveRoomName, 6000);
    console.log(`  Node B acquire lock (while held by A): ${lockAcquiredB}`);
    if (lockAcquiredB) throw new Error("Hazard: Node B acquired lock while held by Node A!");

    await adapterA.releaseFlushLock(liveRoomName);
    const lockAcquiredBAfter = await adapterB.acquireFlushLock(liveRoomName, 6000);
    console.log(`  Node B acquire lock (after release): ${lockAcquiredBAfter}`);
    if (!lockAcquiredBAfter) throw new Error("Node B failed to acquire lock after release!");
    await adapterB.releaseFlushLock(liveRoomName);
    console.log("  [PASS] Real Redis distributed persistence lock verified.\n");

    // LIVE TEST 6: Cold Node / Late Joiner Catch-Up Sync
    console.log("LIVE TEST 6: Cold Node Late Joiner Catch-Up Sync");
    console.log("  Node A types uncommitted edits into room...");
    docA.insert(docA.length, " [Unpersisted edit on Node A]");

    console.log("  Spinning up new Server Instance C (Late Joiner with no prior local state)...");
    const adapterC = new RedisCollabAdapter({
      redisUrl,
      prefix: "test:live:collab:",
    });
    await waitForCondition(() => adapterC.isConnected, 5000);

    const persistenceC = new MockPersistenceAdapter();
    const roomC = new CollabRoom(liveRoomIdent, persistenceC, adapterC);

    // Initialize Server C: It should request room sync from Node A/B and catch up!
    await roomC.initialize();

    const docC = roomC.doc.getText("content");
    console.log(`  Server C document text on boot: '${docC.toString()}'`);

    await waitForCondition(() => docC.toString() === docA.toString());
    console.log(`  Server C caught-up text: '${docC.toString()}'`);
    if (docC.toString() !== docA.toString()) {
      throw new Error("Server C failed to catch up with Server A's uncommitted in-memory edits!");
    }
    console.log("  [PASS] Cold Node caught up with live in-memory changes via inter-server sync.\n");

    await roomC.destroy();
    await adapterC.disconnect();

    console.log("=================================================");
    console.log("ALL LIVE DOCKER REDIS TESTS PASSED (6/6)!");
    console.log("=================================================\n");

    await roomA.destroy();
    await roomB.destroy();
    await adapterA.disconnect();
    await adapterB.disconnect();
  } catch (err) {
    await roomA.destroy().catch(() => {});
    await roomB.destroy().catch(() => {});
    await adapterA.disconnect().catch(() => {});
    await adapterB.disconnect().catch(() => {});
    throw err;
  }
}

async function main() {
  await runMockCoordinationSuite();
  await runLiveDockerRedisSuite();
  console.log("=================================================");
  console.log("ALL PHASE 7A REDIS COORDINATION TESTS COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nTEST SUITE FAILED WITH ERROR:");
  console.error(err);
  process.exit(1);
});
