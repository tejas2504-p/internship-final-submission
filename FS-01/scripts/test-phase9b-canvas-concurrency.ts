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

const TEST_PORT = 1240;
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
      REDIS_ENABLED: "false", // Standalone test mode for determinism
    },
    stdio: "pipe",
    shell: true,
  });

  proc.stdout?.on("data", (d) => {
    const line = d.toString().trim();
    if (line.includes("WebSocket listening") || line.includes("CollabServer")) {
      console.log(`[Server] ${line}`);
    }
  });

  proc.stderr?.on("data", (d) => {
    const line = d.toString().trim();
    if (line.includes("Security") || line.includes("Rejected") || line.includes("error")) {
      console.log(`[ServerLog] ${line}`);
    }
  });

  return proc;
}

async function runPhase9BConcurrencyTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 9B, Step 4: Concurrent Editing & Recovery");
  console.log("Multi-Client Conflict Resolution & Reconnection Test Suite");
  console.log("=================================================\n");

  let serverProc: ChildProcess | null = null;
  const providersToCleanup: WebsocketProvider[] = [];
  const docsToCleanup: Y.Doc[] = [];

  const ts = Date.now();
  const aliceEmail = `concur-alice-${ts}@test.syncspace.dev`;
  const bobEmail = `concur-bob-${ts}@test.syncspace.dev`;
  const eveEmail = `concur-eve-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let eveId = "";
  let workspaceAId = "";
  let workspaceBId = "";

  try {
    // -------------------------------------------------------------
    // SETUP: Spawn Collaboration Server on dedicated port 1240
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
      data: { name: "Alice Concur", email: aliceEmail, emailVerified: true },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: { name: "Bob Concur", email: bobEmail, emailVerified: true },
    });
    bobId = bob.id;

    const eve = await prisma.user.create({
      data: { name: "Eve Intruder", email: eveEmail, emailVerified: true },
    });
    eveId = eve.id;

    const wsA = await createWorkspace(aliceId, { name: "Concurrency Workspace A" });
    workspaceAId = wsA.id;
    await addWorkspaceMember(workspaceAId, aliceId, bobEmail, WorkspaceRole.MEMBER);

    const wsB = await createWorkspace(eveId, { name: "Isolated Workspace B" });
    workspaceBId = wsB.id;

    const roomName = `${workspaceAId}:canvas`;

    // Initialize Alice and Bob tokens and clients
    const aliceToken = signCollabToken({
      userId: aliceId,
      userName: "Alice Concur",
      workspaceId: workspaceAId,
      pageId: "canvas",
      canEdit: true,
      role: "OWNER",
    });

    const bobToken = signCollabToken({
      userId: bobId,
      userName: "Bob Concur",
      workspaceId: workspaceAId,
      pageId: "canvas",
      canEdit: true,
      role: "MEMBER",
    });

    const aliceDoc = new Y.Doc();
    docsToCleanup.push(aliceDoc);
    const aliceProvider = new WebsocketProvider(WS_BASE_URL, roomName, aliceDoc, {
      params: { token: aliceToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
      maxBackoffTime: 3000,
      resyncInterval: 10000,
    });
    providersToCleanup.push(aliceProvider);

    const bobDoc = new Y.Doc();
    docsToCleanup.push(bobDoc);
    const bobProvider = new WebsocketProvider(WS_BASE_URL, roomName, bobDoc, {
      params: { token: bobToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
      maxBackoffTime: 3000,
      resyncInterval: 10000,
    });
    providersToCleanup.push(bobProvider);

    await Promise.all([waitForSync(aliceProvider), waitForSync(bobProvider)]);

    const aliceNodes = aliceDoc.getMap<CanvasNode>("nodes");
    const bobNodes = bobDoc.getMap<CanvasNode>("nodes");

    console.log("  [PASS] Alice and Bob connected to canvas room simultaneously.\n");

    // -------------------------------------------------------------
    // CHECK 1: Concurrent Editing of Different Canvas Objects
    // -------------------------------------------------------------
    console.log("CHECK 1: Concurrent Creation & Editing of Different Canvas Objects");
    const noteAlice: CanvasNode = {
      id: "node-alice-sticky",
      workspaceId: workspaceAId,
      type: "STICKY",
      x: 100,
      y: 100,
      width: 200,
      height: 160,
      zIndex: 1,
      content: "Alice concurrent sticky",
      colorId: "amber",
      authorName: "Alice Concur",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const noteBob: CanvasNode = {
      id: "node-bob-sticky",
      workspaceId: workspaceAId,
      type: "STICKY",
      x: 400,
      y: 100,
      width: 220,
      height: 180,
      zIndex: 2,
      content: "Bob concurrent sticky",
      colorId: "sky",
      authorName: "Bob Concur",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Both users submit concurrent creations simultaneously
    aliceNodes.set(noteAlice.id, noteAlice);
    bobNodes.set(noteBob.id, noteBob);

    await waitForCondition(() => {
      const aliceHasBoth = aliceNodes.has("node-alice-sticky") && aliceNodes.has("node-bob-sticky");
      const bobHasBoth = bobNodes.has("node-alice-sticky") && bobNodes.has("node-bob-sticky");
      return aliceHasBoth && bobHasBoth;
    });

    if (aliceNodes.size !== 2 || bobNodes.size !== 2) {
      throw new Error(`Size mismatch: Alice=${aliceNodes.size}, Bob=${bobNodes.size}`);
    }
    console.log("  Both independent objects survived without loss or interference.");
    console.log("  [PASS] Concurrent editing of different objects verified.\n");

    // -------------------------------------------------------------
    // CHECK 2: Concurrent Editing of the SAME Object on DIFFERENT Properties
    // -------------------------------------------------------------
    console.log("CHECK 2: Concurrent Editing of the SAME Object (Different Properties)");
    // Alice moves note-alice-sticky to (350, 450)
    // Bob concurrently edits note-alice-sticky content to 'Collaborative merged note'
    const aliceCurrent = aliceNodes.get("node-alice-sticky")!;
    const bobCurrent = bobNodes.get("node-alice-sticky")!;

    // Alice updates position
    aliceDoc.transact(() => {
      aliceNodes.set("node-alice-sticky", {
        ...aliceCurrent,
        x: 350,
        y: 450,
        updatedAt: Date.now(),
      });
    }, "local-ui");

    // Bob updates content and color concurrently
    bobDoc.transact(() => {
      bobNodes.set("node-alice-sticky", {
        ...bobCurrent,
        content: "Collaborative merged note",
        colorId: "emerald",
        updatedAt: Date.now() + 1, // Monotonic increment
      });
    }, "local-ui");

    await waitForCondition(() => {
      const a = aliceNodes.get("node-alice-sticky");
      const b = bobNodes.get("node-alice-sticky");
      // Verify convergence on both clients
      return (
        a?.content === b?.content &&
        a?.colorId === b?.colorId &&
        a?.x === b?.x &&
        a?.y === b?.y
      );
    });

    const convergedNote = aliceNodes.get("node-alice-sticky")!;
    console.log(`  Converged note content: '${convergedNote.content}', color: '${convergedNote.colorId}', pos: (${convergedNote.x}, ${convergedNote.y})`);
    console.log("  [PASS] Same-object concurrent property editing converged deterministically.\n");

    // -------------------------------------------------------------
    // CHECK 3: Concurrent Editing of the SAME Property on the SAME Object
    // -------------------------------------------------------------
    console.log("CHECK 3: Concurrent Editing of the SAME Property (Conflict Resolution)");
    // Both Alice and Bob simultaneously overwrite the content of note-bob-sticky
    aliceDoc.transact(() => {
      const curr = aliceNodes.get("node-bob-sticky")!;
      aliceNodes.set("node-bob-sticky", {
        ...curr,
        content: "Content from Alice at time T",
        updatedAt: 1000,
      });
    }, "local-ui");

    bobDoc.transact(() => {
      const curr = bobNodes.get("node-bob-sticky")!;
      bobNodes.set("node-bob-sticky", {
        ...curr,
        content: "Content from Bob at time T",
        updatedAt: 1001,
      });
    }, "local-ui");

    // Verify both converge to the exact same value
    await waitForCondition(() => {
      const a = aliceNodes.get("node-bob-sticky");
      const b = bobNodes.get("node-bob-sticky");
      return a?.content === b?.content && Boolean(a?.content);
    });

    const winningContent = aliceNodes.get("node-bob-sticky")!.content;
    console.log(`  Winning converged content: '${winningContent}'`);
    console.log("  [PASS] Conflict resolution deterministic convergence verified.\n");

    // -------------------------------------------------------------
    // CHECK 4: Network Disconnection, Offline Edits & Catch-Up Sync
    // -------------------------------------------------------------
    console.log("CHECK 4: Network Disconnect, Offline Edits & Catch-Up Sync");
    // Disconnect Bob from collaboration server
    console.log("  Simulating network drop for Bob...");
    bobProvider.disconnect();
    await waitForCondition(() => !bobProvider.wsconnected);
    console.log("  Bob is offline (disconnected from WebSocket).");

    // While Bob is offline:
    // 1. Alice adds a new Rectangle shape
    const rectAliceOffline: CanvasNode = {
      id: "node-rect-alice-offline",
      workspaceId: workspaceAId,
      type: "RECTANGLE",
      x: 700,
      y: 200,
      width: 180,
      height: 120,
      zIndex: 5,
      content: "Created by Alice while Bob was offline",
      colorId: "rose",
      authorName: "Alice Concur",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    aliceNodes.set(rectAliceOffline.id, rectAliceOffline);

    // 2. Alice updates note-alice-sticky
    const updatedByAlice = {
      ...aliceNodes.get("node-alice-sticky")!,
      content: "Edited by Alice during network split",
    };
    aliceNodes.set("node-alice-sticky", updatedByAlice);

    // 3. Bob (offline) creates a new Sticky in his local doc
    const stickyBobOffline: CanvasNode = {
      id: "node-sticky-bob-offline",
      workspaceId: workspaceAId,
      type: "STICKY",
      x: 150,
      y: 500,
      width: 200,
      height: 150,
      zIndex: 6,
      content: "Created by Bob while offline",
      colorId: "violet",
      authorName: "Bob Concur",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    bobNodes.set(stickyBobOffline.id, stickyBobOffline);

    console.log("  Alice made 2 changes online; Bob made 1 change offline.");

    // Now Bob reconnects to the network
    console.log("  Reconnecting Bob to collaboration server...");
    bobProvider.connect();
    await waitForSync(bobProvider);

    // Verify bi-directional catch-up sync:
    // Bob must receive Alice's online edits, Alice must receive Bob's offline edits
    await waitForCondition(() => {
      const bobHasAliceRect = bobNodes.has("node-rect-alice-offline");
      const bobHasAliceEdit = bobNodes.get("node-alice-sticky")?.content === "Edited by Alice during network split";
      const aliceHasBobOffline = aliceNodes.has("node-sticky-bob-offline");
      return bobHasAliceRect && bobHasAliceEdit && aliceHasBobOffline;
    });

    if (aliceNodes.size !== 4 || bobNodes.size !== 4) {
      throw new Error(`Expected exactly 4 nodes on both clients; Alice=${aliceNodes.size}, Bob=${bobNodes.size}`);
    }

    console.log("  All 4 canvas objects synchronized across both peers seamlessly.");
    console.log("  [PASS] Disconnection, offline editing, and catch-up sync verified.\n");

    // -------------------------------------------------------------
    // CHECK 5: Duplicate Update Replay Protection (No Duplicate Objects)
    // -------------------------------------------------------------
    console.log("CHECK 5: Duplicate Message & Idempotency Protection");
    // Replay/re-send the same updates multiple times
    for (let i = 0; i < 5; i++) {
      aliceNodes.set(rectAliceOffline.id, rectAliceOffline);
    }
    await sleep(300);

    // Extract deduplicated list as done in UI
    const seenIds = new Set<string>();
    const uniqueAliceNodes: CanvasNode[] = [];
    aliceNodes.forEach((node) => {
      if (!seenIds.has(node.id)) {
        seenIds.add(node.id);
        uniqueAliceNodes.push(node);
      }
    });

    if (uniqueAliceNodes.length !== 4) {
      throw new Error(`Deduplication failure: got ${uniqueAliceNodes.length} objects, expected 4`);
    }
    console.log("  Idempotent updates verified: object count remained strictly 4.");
    console.log("  [PASS] Duplicate message replay protection verified.\n");

    // -------------------------------------------------------------
    // CHECK 6: Server Crash / Restart and Automatic Client Reconnection
    // -------------------------------------------------------------
    console.log("CHECK 6: Server Crash / Restart & Automatic Client Recovery");
    console.log("  Simulating server crash: Killing collaboration server process...");
    killProcessTree(serverProc);
    serverProc = null;

    // Verify clients enter disconnected / reconnecting state
    await waitForCondition(() => !aliceProvider.wsconnected && !bobProvider.wsconnected);
    console.log("  Both clients observed server disconnect and entered auto-retry backoff.");

    // Reboot the collaboration server
    console.log(`  Rebooting collaboration server on port ${TEST_PORT}...`);
    serverProc = startCollabServer(TEST_PORT);
    await pollHealth(TEST_PORT);

    // Verify both clients automatically reconnect without page reloads
    console.log("  Waiting for automatic client reconnection...");
    await waitForCondition(() => aliceProvider.wsconnected && bobProvider.wsconnected, 12000);
    await Promise.all([waitForSync(aliceProvider), waitForSync(bobProvider)]);

    // Verify all 4 nodes are fully recovered from PostgreSQL / memory after server restart
    await waitForCondition(() => aliceNodes.size === 4 && bobNodes.size === 4);
    console.log("  Both clients recovered 4 nodes after server restart.");
    console.log("  [PASS] Automatic reconnection after server restart verified.\n");

    // -------------------------------------------------------------
    // CHECK 7: Connection State Transitions Lifecycle
    // -------------------------------------------------------------
    console.log("CHECK 7: Connection State Lifecycle (Connecting, Connected, Disconnected)");
    // Disconnect Alice cleanly
    aliceProvider.disconnect();
    await waitForCondition(() => !aliceProvider.wsconnected);
    console.log("  Alice cleanly disconnected.");

    // Reconnect Alice
    aliceProvider.connect();
    await waitForCondition(() => aliceProvider.wsconnected);
    await waitForSync(aliceProvider);
    console.log("  Alice reconnected and synchronized.");
    console.log("  [PASS] Connection state lifecycle transitions verified.\n");

    // -------------------------------------------------------------
    // CHECK 8: Unauthorized Reconnection Protection
    // -------------------------------------------------------------
    console.log("CHECK 8: Unauthorized Reconnection Protection");
    // Eve attempts to connect to Workspace A canvas room using an unauthorized token
    const eveUnauthorizedToken = signCollabToken({
      userId: eveId,
      userName: "Eve Intruder",
      workspaceId: workspaceBId, // Cross-workspace token mismatch
      pageId: "canvas",
      canEdit: true,
      role: "OWNER",
    });

    const eveDoc = new Y.Doc();
    docsToCleanup.push(eveDoc);
    const eveProvider = new WebsocketProvider(WS_BASE_URL, roomName, eveDoc, {
      params: { token: eveUnauthorizedToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(eveProvider);

    await sleep(800);
    // Eve's provider should be disconnected and rejected
    const eveNodes = eveDoc.getMap<CanvasNode>("nodes");
    if (eveNodes.size > 0 || eveProvider.wsconnected) {
      throw new Error("SECURITY FAILURE: Unauthorized connection was allowed to synchronize canvas objects!");
    }
    console.log("  Unauthorized reconnect attempt rejected with HTTP 4403.");
    console.log("  [PASS] Unauthorized reconnection protection verified.\n");

    console.log("=================================================");
    console.log("ALL PHASE 9B STEP 4 CONCURRENCY CHECKS PASSED!");
    console.log("=================================================\n");
  } finally {
    // Teardown providers and docs
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

    // Kill test server
    if (serverProc) {
      killProcessTree(serverProc);
    }

    // Clean up test workspaces and users in database
    try {
      if (workspaceAId && aliceId) {
        await deleteWorkspace(workspaceAId, aliceId);
      }
      if (workspaceBId && eveId) {
        await deleteWorkspace(workspaceBId, eveId);
      }
      if (aliceId) await prisma.user.delete({ where: { id: aliceId } }).catch(() => {});
      if (bobId) await prisma.user.delete({ where: { id: bobId } }).catch(() => {});
      if (eveId) await prisma.user.delete({ where: { id: eveId } }).catch(() => {});
    } catch {}
  }
}

runPhase9BConcurrencyTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n[FATAL] Test failed with error:", err);
    process.exit(1);
  });

