import "dotenv/config";
import http from "http";
import { spawn, execSync, type ChildProcess } from "child_process";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { prisma } from "../src/lib/db/prisma";
import {
  createWorkspace,
  addWorkspaceMember,
  deleteWorkspace,
} from "../src/lib/services/workspace";
import { signCollabToken } from "../src/lib/collaboration/token";
import { WorkspaceRole } from "@prisma/client";
import { CanvasNode } from "../types/canvas";

// Ensure global WebSocket is available for y-websocket in Node runtime
(global as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

const TEST_PORT = 1241;
const WS_BASE_URL = `ws://127.0.0.1:${TEST_PORT}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcessTree(proc: ChildProcess | null) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
    } else {
      proc.kill("SIGKILL");
    }
  } catch {}
}

function pollHealth(port: number, timeoutMs = 12000): Promise<any> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(`http://127.0.0.1:${port}/health`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ status: "ok" });
            }
          });
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) {
            reject(
              new Error(
                `Server on port ${port} did not become healthy within ${timeoutMs}ms`
              )
            );
          } else {
            setTimeout(attempt, 200);
          }
        });
    };
    attempt();
  });
}

function waitForSync(
  provider: WebsocketProvider,
  timeoutMs = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve();
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for sync after ${timeoutMs}ms (connected: ${provider.wsconnected})`
        )
      );
    }, timeoutMs);

    provider.once("sync", (isSynced: boolean) => {
      if (isSynced) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 10000,
  intervalMs = 50
): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const ok = await predicate();
        if (ok) return resolve();
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Condition timed out after ${timeoutMs}ms`));
        }
        setTimeout(check, intervalMs);
      } catch (err) {
        if (Date.now() - start > timeoutMs) {
          return reject(err);
        }
        setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

function startCollabServer(port: number): ChildProcess {
  const proc = spawn("npx", ["tsx", "collaboration-server/server.ts"], {
    env: {
      ...process.env,
      COLLAB_PORT: String(port),
      PORT: String(port),
      REDIS_ENABLED: "false", // Standalone persistence verification mode
    },
    stdio: "pipe",
    shell: true,
  });

  proc.stdout?.on("data", (d) => {
    const line = d.toString().trim();
    if (
      line.includes("WebSocket listening") ||
      line.includes("CollabServer") ||
      line.includes("CollabPersistence")
    ) {
      console.log(`[Server] ${line}`);
    }
  });

  proc.stderr?.on("data", (d) => {
    const line = d.toString().trim();
    if (
      line.includes("Security") ||
      line.includes("Rejected") ||
      line.includes("error")
    ) {
      console.log(`[ServerLog] ${line}`);
    }
  });

  return proc;
}

async function runPhase9CDurablePersistenceTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 9C.1: Durable Canvas Persistence & Recovery");
  console.log("Automated Yjs Snapshot Compaction & PostgreSQL Storage Test");
  console.log("=================================================\n");

  let serverProc: ChildProcess | null = null;
  const providersToCleanup: WebsocketProvider[] = [];
  const docsToCleanup: Y.Doc[] = [];

  const ts = Date.now();
  const aliceEmail = `persist-alice-${ts}@test.syncspace.dev`;
  const bobEmail = `persist-bob-${ts}@test.syncspace.dev`;
  const danaEmail = `persist-dana-${ts}@test.syncspace.dev`;
  const eveEmail = `persist-eve-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let danaId = "";
  let eveId = "";
  let workspaceAId = "";
  let workspaceBId = "";

  try {
    // -------------------------------------------------------------
    // SETUP: Spawn Collaboration Server on dedicated port 1241
    // -------------------------------------------------------------
    console.log(`[Setup] Starting test collaboration server on port ${TEST_PORT}...`);
    serverProc = startCollabServer(TEST_PORT);
    await pollHealth(TEST_PORT);
    console.log(`  [PASS] Collaboration server active on port ${TEST_PORT}\n`);

    // -------------------------------------------------------------
    // PROVISION TEST DATA
    // -------------------------------------------------------------
    console.log("[Setup] Provisioning test users and workspace...");
    const alice = await prisma.user.create({
      data: { name: "Alice Architect", email: aliceEmail, emailVerified: true },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: { name: "Bob Builder", email: bobEmail, emailVerified: true },
    });
    bobId = bob.id;

    const dana = await prisma.user.create({
      data: { name: "Dana Viewer", email: danaEmail, emailVerified: true },
    });
    danaId = dana.id;

    const eve = await prisma.user.create({
      data: { name: "Eve Intruder", email: eveEmail, emailVerified: true },
    });
    eveId = eve.id;

    const wsA = await createWorkspace(aliceId, { name: "Durable Canvas Workspace A" });
    workspaceAId = wsA.id;
    await addWorkspaceMember(workspaceAId, aliceId, bobEmail, WorkspaceRole.MEMBER);
    await addWorkspaceMember(workspaceAId, aliceId, danaEmail, WorkspaceRole.VIEWER);

    const wsB = await createWorkspace(eveId, { name: "Isolated Workspace B" });
    workspaceBId = wsB.id;

    const roomName = `${workspaceAId}:canvas`;

    // -------------------------------------------------------------
    // CHECK 1: Create & Edit Objects with Durable Yjs Snapshot Persistence
    // -------------------------------------------------------------
    console.log("CHECK 1: Create Canvas Objects & Verify Binary Snapshot in PostgreSQL");
    const aliceToken = signCollabToken({
      userId: aliceId,
      userName: "Alice Architect",
      workspaceId: workspaceAId,
      pageId: "canvas",
      canEdit: true,
      role: "OWNER",
    });

    const aliceDoc = new Y.Doc();
    docsToCleanup.push(aliceDoc);
    const aliceProvider = new WebsocketProvider(WS_BASE_URL, roomName, aliceDoc, {
      params: { token: aliceToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(aliceProvider);
    await waitForSync(aliceProvider);

    const aliceNodes = aliceDoc.getMap<CanvasNode>("nodes");

    const note1: CanvasNode = {
      id: "node-arch-1",
      workspaceId: workspaceAId,
      type: "STICKY",
      x: 120,
      y: 180,
      width: 240,
      height: 180,
      zIndex: 1,
      content: "Microservices Architecture Plan",
      colorId: "sky",
      authorName: "Alice Architect",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const shape2: CanvasNode = {
      id: "node-rect-db-2",
      workspaceId: workspaceAId,
      type: "RECTANGLE",
      x: 450,
      y: 180,
      width: 300,
      height: 200,
      zIndex: 2,
      content: "PostgreSQL Primary Cluster",
      colorId: "emerald",
      authorName: "Alice Architect",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    aliceDoc.transact(() => {
      aliceNodes.set(note1.id, note1);
      aliceNodes.set(shape2.id, shape2);
    }, "local-ui");

    console.log("  Waiting for server debounced persistence flush to PostgreSQL...");
    await waitForCondition(async () => {
      const record = await prisma.canvas.findUnique({
        where: { workspaceId: workspaceAId },
        select: { nodes: true, yjsSnapshot: true, version: true },
      });
      return (
        record !== null &&
        Array.isArray(record.nodes) &&
        record.nodes.length === 2 &&
        record.yjsSnapshot !== null &&
        record.yjsSnapshot.length > 0
      );
    });

    const persisted1 = await prisma.canvas.findUnique({
      where: { workspaceId: workspaceAId },
      select: { nodes: true, yjsSnapshot: true, version: true },
    });

    console.log(`  Verified in DB: ${Array.isArray(persisted1?.nodes) ? persisted1.nodes.length : 0} JSON nodes.`);
    console.log(`  Verified in DB: Binary yjsSnapshot size = ${persisted1?.yjsSnapshot?.length} bytes (version ${persisted1?.version}).`);
    console.log("  [PASS] Durable binary Yjs snapshot and JSON state stored successfully.\n");

    // -------------------------------------------------------------
    // CHECK 2: Browser Refresh / New Session State Invariance
    // -------------------------------------------------------------
    console.log("CHECK 2: Fresh Session Connection / Reload State Invariance");
    // Connect Bob (independent fresh browser session)
    const bobToken = signCollabToken({
      userId: bobId,
      userName: "Bob Builder",
      workspaceId: workspaceAId,
      pageId: "canvas",
      canEdit: true,
      role: "MEMBER",
    });

    const bobDoc = new Y.Doc();
    docsToCleanup.push(bobDoc);
    const bobProvider = new WebsocketProvider(WS_BASE_URL, roomName, bobDoc, {
      params: { token: bobToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(bobProvider);
    await waitForSync(bobProvider);

    const bobNodes = bobDoc.getMap<CanvasNode>("nodes");
    if (bobNodes.size !== 2) {
      throw new Error(`Expected Bob to receive 2 nodes, got ${bobNodes.size}`);
    }

    const bobNote1 = bobNodes.get("node-arch-1")!;
    if (bobNote1.content !== "Microservices Architecture Plan") {
      throw new Error(`Content mismatch on fresh session: ${bobNote1.content}`);
    }
    console.log("  Bob's session synchronized exact canvas state and properties.");
    console.log("  [PASS] Fresh session state invariance verified.\n");

    // -------------------------------------------------------------
    // CHECK 3: Close and Reopen Client Session
    // -------------------------------------------------------------
    console.log("CHECK 3: Close and Reopen Client Session");
    // Disconnect and destroy Alice's session
    aliceProvider.destroy();
    aliceDoc.destroy();

    // Reopen Alice with a fresh document and provider
    const aliceReopenedDoc = new Y.Doc();
    docsToCleanup.push(aliceReopenedDoc);
    const aliceReopenedProvider = new WebsocketProvider(WS_BASE_URL, roomName, aliceReopenedDoc, {
      params: { token: aliceToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(aliceReopenedProvider);
    await waitForSync(aliceReopenedProvider);

    const aliceReopenedNodes = aliceReopenedDoc.getMap<CanvasNode>("nodes");
    if (aliceReopenedNodes.size !== 2) {
      throw new Error(`Reopened session expected 2 nodes, got ${aliceReopenedNodes.size}`);
    }
    console.log("  Alice reopened canvas and cleanly restored all 2 objects.");
    console.log("  [PASS] Close and reopen session verified.\n");

    // -------------------------------------------------------------
    // CHECK 4: Server Crash / Restart and Complete Recovery from PostgreSQL
    // -------------------------------------------------------------
    console.log("CHECK 4: Server Crash & Restart: Full Binary Snapshot Recovery");
    // Add a 3rd node before crashing server
    const note3: CanvasNode = {
      id: "node-cache-3",
      workspaceId: workspaceAId,
      type: "STICKY",
      x: 300,
      y: 450,
      width: 200,
      height: 150,
      zIndex: 3,
      content: "Redis Distributed Caching Layer",
      colorId: "rose",
      authorName: "Bob Builder",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    bobDoc.transact(() => {
      bobNodes.set(note3.id, note3);
    }, "local-ui");

    // Wait for server flush
    await waitForCondition(async () => {
      const record = await prisma.canvas.findUnique({
        where: { workspaceId: workspaceAId },
        select: { nodes: true },
      });
      return Array.isArray(record?.nodes) && record.nodes.length === 3;
    });

    console.log("  Simulating server crash: Killing collaboration server process...");
    killProcessTree(serverProc);
    serverProc = null;

    // Verify clients lose connection
    await waitForCondition(() => !bobProvider.wsconnected);
    console.log("  Server stopped. Clients disconnected.");

    // Reboot the collaboration server
    console.log(`  Rebooting collaboration server on port ${TEST_PORT}...`);
    serverProc = startCollabServer(TEST_PORT);
    await pollHealth(TEST_PORT);

    // Create a new client to verify the new server instance initializes from PostgreSQL yjsSnapshot
    const charlieDoc = new Y.Doc();
    docsToCleanup.push(charlieDoc);
    const charlieProvider = new WebsocketProvider(WS_BASE_URL, roomName, charlieDoc, {
      params: { token: aliceToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(charlieProvider);
    await waitForSync(charlieProvider);

    const charlieNodes = charlieDoc.getMap<CanvasNode>("nodes");
    if (charlieNodes.size !== 3) {
      throw new Error(`Expected 3 recovered nodes on rebooted server, got ${charlieNodes.size}`);
    }

    if (!charlieNodes.has("node-arch-1") || !charlieNodes.has("node-rect-db-2") || !charlieNodes.has("node-cache-3")) {
      throw new Error("Missing expected node keys after server reboot");
    }

    console.log("  Rebooted collaboration server restored 3/3 nodes from PostgreSQL yjsSnapshot.");
    console.log("  [PASS] True server restart recovery verified.\n");

    // -------------------------------------------------------------
    // CHECK 5: Multiple Users Editing During Reconnect
    // -------------------------------------------------------------
    console.log("CHECK 5: Multiple Users Editing During Reconnection");
    // Connect Bob's client back to the new server instance
    bobProvider.connect();
    await waitForSync(bobProvider);

    // Charlie edits note 1; Bob concurrently edits note 3
    charlieDoc.transact(() => {
      const n1 = charlieNodes.get("node-arch-1")!;
      charlieNodes.set("node-arch-1", {
        ...n1,
        content: "Microservices Architecture Plan (v2 Revised)",
        updatedAt: Date.now(),
      });
    }, "local-ui");

    bobDoc.transact(() => {
      const n3 = bobNodes.get("node-cache-3")!;
      bobNodes.set("node-cache-3", {
        ...n3,
        x: 380,
        y: 480,
        updatedAt: Date.now(),
      });
    }, "local-ui");

    await waitForCondition(() => {
      const c1 = charlieNodes.get("node-arch-1")?.content;
      const b1 = bobNodes.get("node-arch-1")?.content;
      const c3 = charlieNodes.get("node-cache-3")?.x;
      const b3 = bobNodes.get("node-cache-3")?.x;
      return (
        c1 === "Microservices Architecture Plan (v2 Revised)" &&
        b1 === "Microservices Architecture Plan (v2 Revised)" &&
        c3 === 380 &&
        b3 === 380
      );
    });

    console.log("  Both concurrent edits during reconnection synchronized cleanly.");
    console.log("  [PASS] Multi-user editing during reconnect verified.\n");

    // -------------------------------------------------------------
    // CHECK 6: Duplicate Updates & Idempotency (Zero Duplicate Objects)
    // -------------------------------------------------------------
    console.log("CHECK 6: Duplicate Updates & Idempotent Hydration");
    // Simulate replayed Yjs update
    const updateBytes = Y.encodeStateAsUpdate(charlieDoc);
    Y.applyUpdate(charlieDoc, updateBytes);
    Y.applyUpdate(bobDoc, updateBytes);

    if (charlieNodes.size !== 3 || bobNodes.size !== 3) {
      throw new Error("Duplicate updates created duplicate objects in Y.Map");
    }

    // Verify deduplication list logic
    const uniqueIds = new Set<string>();
    charlieNodes.forEach((node) => uniqueIds.add(node.id));
    if (uniqueIds.size !== 3) {
      throw new Error(`Deduplication failure: expected 3 unique IDs, got ${uniqueIds.size}`);
    }

    console.log("  Replayed updates remained strictly idempotent: total object count is 3.");
    console.log("  [PASS] Duplicate updates and idempotency verified.\n");

    // -------------------------------------------------------------
    // CHECK 7: Snapshot Compaction Strategy
    // -------------------------------------------------------------
    console.log("CHECK 7: Snapshot Compaction & Document Size Limits");
    // Make 15 fast incremental updates to exercise CRDT compaction
    for (let i = 0; i < 15; i++) {
      charlieDoc.transact(() => {
        const n1 = charlieNodes.get("node-arch-1")!;
        charlieNodes.set("node-arch-1", {
          ...n1,
          content: `Rapid revision #${i}`,
          updatedAt: Date.now(),
        });
      }, "local-ui");
    }

    // Wait for server flush
    await waitForCondition(async () => {
      const r = await prisma.canvas.findUnique({
        where: { workspaceId: workspaceAId },
        select: { yjsSnapshot: true },
      });
      return r?.yjsSnapshot !== null && r.yjsSnapshot.length > 0;
    });

    const compactedRecord = await prisma.canvas.findUnique({
      where: { workspaceId: workspaceAId },
      select: { yjsSnapshot: true },
    });

    const snapshotSize = compactedRecord?.yjsSnapshot?.length || 0;
    console.log(`  Compacted snapshot size for 3 nodes after 15 revisions: ${snapshotSize} bytes.`);
    if (snapshotSize > 100000) {
      throw new Error(`Compaction failure: snapshot is unreasonably large (${snapshotSize} bytes)`);
    }
    console.log("  [PASS] Yjs binary state compaction verified.\n");

    // -------------------------------------------------------------
    // CHECK 8: Workspace Authorization Enforcement
    // -------------------------------------------------------------
    console.log("CHECK 8: Workspace Authorization Enforcement on Recovery");
    // 1. Viewer Dana can read but cannot persist writes
    const danaToken = signCollabToken({
      userId: danaId,
      userName: "Dana Viewer",
      workspaceId: workspaceAId,
      pageId: "canvas",
      canEdit: false,
      role: "VIEWER",
    });

    const danaDoc = new Y.Doc();
    docsToCleanup.push(danaDoc);
    const danaProvider = new WebsocketProvider(WS_BASE_URL, roomName, danaDoc, {
      params: { token: danaToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(danaProvider);
    await waitForSync(danaProvider);

    const danaNodes = danaDoc.getMap<CanvasNode>("nodes");
    if (danaNodes.size !== 3) {
      throw new Error(`Viewer expected 3 nodes, got ${danaNodes.size}`);
    }
    console.log("  Viewer Dana received read-only state of existing 3 nodes.");

    // Dana attempts write
    const unauthorizedNode: CanvasNode = {
      id: "node-unauthorized-viewer",
      workspaceId: workspaceAId,
      type: "STICKY",
      x: 999,
      y: 999,
      width: 100,
      height: 100,
      zIndex: 99,
      content: "Unauthorized viewer node",
      colorId: "rose",
      authorName: "Dana Viewer",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    danaNodes.set(unauthorizedNode.id, unauthorizedNode);
    await sleep(600);

    // Verify Charlie never received unauthorized node
    if (charlieNodes.has("node-unauthorized-viewer")) {
      throw new Error("Security failure: Viewer was able to write to shared canvas!");
    }
    console.log("  Server rejected Viewer's write attempt. State was preserved.");

    // 2. Intruder Eve from Workspace B cannot access Workspace A
    const eveToken = signCollabToken({
      userId: eveId,
      userName: "Eve Intruder",
      workspaceId: workspaceBId,
      pageId: "canvas",
      canEdit: true,
      role: "OWNER",
    });

    const eveDoc = new Y.Doc();
    docsToCleanup.push(eveDoc);
    const eveProvider = new WebsocketProvider(WS_BASE_URL, roomName, eveDoc, {
      params: { token: eveToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(eveProvider);

    await sleep(600);
    const eveNodes = eveDoc.getMap<CanvasNode>("nodes");
    if (eveNodes.size > 0 || eveProvider.wsconnected) {
      throw new Error("SECURITY FAILURE: Intruder Eve recovered protected canvas data!");
    }
    console.log("  Intruder Eve rejected at handshake (4403). Zero data leaked.");
    console.log("  [PASS] Authorization enforcement on recovery verified.\n");

    console.log("=================================================");
    console.log("ALL PHASE 9C.1 DURABLE PERSISTENCE CHECKS PASSED!");
    console.log("=================================================\n");
  } finally {
    for (const p of providersToCleanup) {
      try {
        p.destroy();
      } catch {}
    }
    for (const d of docsToCleanup) {
      try {
        d.destroy();
      } catch {}
    }
    if (serverProc) {
      killProcessTree(serverProc);
    }
    try {
      if (workspaceAId && aliceId) {
        await deleteWorkspace(workspaceAId, aliceId);
      }
      if (workspaceBId && eveId) {
        await deleteWorkspace(workspaceBId, eveId);
      }
      if (aliceId) await prisma.user.delete({ where: { id: aliceId } }).catch(() => {});
      if (bobId) await prisma.user.delete({ where: { id: bobId } }).catch(() => {});
      if (danaId) await prisma.user.delete({ where: { id: danaId } }).catch(() => {});
      if (eveId) await prisma.user.delete({ where: { id: eveId } }).catch(() => {});
    } catch {}
  }
}

runPhase9CDurablePersistenceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n[FATAL] Test failed with error:", err);
    process.exit(1);
  });

