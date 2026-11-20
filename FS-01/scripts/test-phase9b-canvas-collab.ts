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

const TEST_PORT = 1238;
const WS_BASE_URL = `ws://127.0.0.1:${TEST_PORT}`;
const HTTP_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

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
            reject(new Error(`Server on port ${port} did not become healthy within ${timeoutMs}ms`));
          } else {
            setTimeout(attempt, 200);
          }
        });
    };
    attempt();
  });
}

function waitForSync(provider: WebsocketProvider, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve();
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for sync after ${timeoutMs}ms (connected: ${provider.wsconnected})`));
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
  timeoutMs = 8000,
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

async function runPhase9BCollabTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 9B: Real-Time Collaborative Canvas");
  console.log("Multi-Client Yjs Synchronization & Persistence Test Suite");
  console.log("=================================================\n");

  let serverProc: ChildProcess | null = null;
  const providersToCleanup: WebsocketProvider[] = [];
  const docsToCleanup: Y.Doc[] = [];

  const ts = Date.now();
  const aliceEmail = `collab-alice-${ts}@test.syncspace.dev`;
  const bobEmail = `collab-bob-${ts}@test.syncspace.dev`;
  const danaEmail = `collab-dana-${ts}@test.syncspace.dev`;
  const eveEmail = `collab-eve-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let danaId = "";
  let eveId = "";
  let workspaceAId = "";
  let workspaceBId = "";

  try {
    // -------------------------------------------------------------
    // Step 0: Spawn dedicated test collaboration server on port 1238
    // -------------------------------------------------------------
    console.log(`[Setup] Starting test collaboration server on port ${TEST_PORT}...`);
    serverProc = spawn("npx", ["tsx", "collaboration-server/server.ts", String(TEST_PORT)], {
      stdio: "pipe",
      shell: true,
      env: { ...process.env, COLLAB_PORT: String(TEST_PORT), PORT: String(TEST_PORT) },
    });
    serverProc.stdout?.on("data", (d) => process.stdout.write(`[Server] ${d.toString()}`));
    serverProc.stderr?.on("data", (d) => process.stderr.write(`[ServerErr] ${d.toString()}`));

    const health = await pollHealth(TEST_PORT);
    console.log("  Health response:", JSON.stringify(health));
    console.log("  [PASS] Collaboration server active on port", TEST_PORT, "\n");

    // -------------------------------------------------------------
    // Step 1: Provision Users and Workspaces
    // -------------------------------------------------------------
    console.log("[Setup] Provisioning test users and workspace...");
    const alice = await prisma.user.create({
      data: { name: "Alice Owner", email: aliceEmail, emailVerified: true },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: { name: "Bob Member", email: bobEmail, emailVerified: true },
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

    const wsA = await createWorkspace(aliceId, { name: "Canvas Collab Lab A" });
    workspaceAId = wsA.id;

    await addWorkspaceMember(workspaceAId, aliceId, bobEmail, WorkspaceRole.MEMBER);
    await addWorkspaceMember(workspaceAId, aliceId, danaEmail, WorkspaceRole.VIEWER);

    const wsB = await createWorkspace(eveId, { name: "Eve Isolated Workspace B" });
    workspaceBId = wsB.id;

    const roomName = `${workspaceAId}:canvas`;

    // -------------------------------------------------------------
    // CHECK 1: Real-Time Canvas Connection & Handshake
    // -------------------------------------------------------------
    console.log("CHECK 1: Two-Client Connection & Handshake (Alice & Bob)");
    const aliceToken = signCollabToken({
      userId: aliceId,
      userName: "Alice Owner",
      workspaceId: workspaceAId,
      pageId: "canvas",
      canEdit: true,
      role: "OWNER",
    });

    const bobToken = signCollabToken({
      userId: bobId,
      userName: "Bob Member",
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
    });
    providersToCleanup.push(aliceProvider);

    const bobDoc = new Y.Doc();
    docsToCleanup.push(bobDoc);
    const bobProvider = new WebsocketProvider(WS_BASE_URL, roomName, bobDoc, {
      params: { token: bobToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(bobProvider);

    await Promise.all([waitForSync(aliceProvider), waitForSync(bobProvider)]);
    console.log("  [PASS] Alice and Bob connected to canvas room simultaneously.\n");

    // -------------------------------------------------------------
    // CHECK 2: Object Creation Synchronization
    // -------------------------------------------------------------
    console.log("CHECK 2: Object Creation Synchronization (Alice -> Bob)");
    const aliceNodes = aliceDoc.getMap<CanvasNode>("nodes");
    const bobNodes = bobDoc.getMap<CanvasNode>("nodes");

    const testStickyNode: CanvasNode = {
      id: "node-sticky-1",
      workspaceId: workspaceAId,
      type: "STICKY",
      x: 150,
      y: 200,
      width: 200,
      height: 180,
      zIndex: 11,
      content: "Brainstorming real-time architecture",
      colorId: "amber",
      authorName: "Alice Owner",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    aliceNodes.set(testStickyNode.id, testStickyNode);

    await waitForCondition(() => bobNodes.has("node-sticky-1"));
    const bobReceivedSticky = bobNodes.get("node-sticky-1");

    if (!bobReceivedSticky || bobReceivedSticky.content !== testStickyNode.content) {
      throw new Error("Bob failed to receive Alice's newly created sticky note!");
    }
    console.log("  Bob received sticky note:", bobReceivedSticky.content);
    console.log("  [PASS] Object creation synchronized in near real time.\n");

    // -------------------------------------------------------------
    // CHECK 3: Concurrent Movement & Property Editing
    // -------------------------------------------------------------
    console.log("CHECK 3: Concurrent Movement & Property Editing (Bi-Directional)");
    // Bob moves the sticky note and edits its text
    bobNodes.set("node-sticky-1", {
      ...bobReceivedSticky,
      x: 320,
      y: 450,
      content: "Brainstorming real-time architecture (reviewed by Bob)",
      colorId: "emerald",
      updatedAt: Date.now(),
    });

    // Concurrently, Alice creates a rectangle
    const testRectNode: CanvasNode = {
      id: "node-rect-2",
      workspaceId: workspaceAId,
      type: "RECTANGLE",
      x: 500,
      y: 100,
      width: 250,
      height: 140,
      zIndex: 12,
      content: "Database Cluster",
      colorId: "sky",
      authorName: "Alice Owner",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    aliceNodes.set(testRectNode.id, testRectNode);

    // Wait for both to converge
    await waitForCondition(() => {
      const aliceHasUpdatedSticky =
        aliceNodes.get("node-sticky-1")?.colorId === "emerald" &&
        aliceNodes.get("node-sticky-1")?.x === 320;
      const bobHasRect = bobNodes.has("node-rect-2");
      return aliceHasUpdatedSticky && bobHasRect;
    });

    if (aliceNodes.size !== 2 || bobNodes.size !== 2) {
      throw new Error(`State divergence: Alice count=${aliceNodes.size}, Bob count=${bobNodes.size}`);
    }
    console.log("  Both clients converged to 2 synchronized objects without conflicts.");
    console.log("  [PASS] Concurrent editing and movement verified.\n");

    // -------------------------------------------------------------
    // CHECK 4: World-Space Cursor & Presence Awareness
    // -------------------------------------------------------------
    console.log("CHECK 4: World-Space Cursor & Presence Awareness");
    aliceProvider.awareness.setLocalState({
      user: {
        userId: aliceId,
        userName: "Alice Owner",
        role: "OWNER",
        canEdit: true,
        color: "#3b82f6",
      },
      cursor: { x: 250, y: 350 },
      selectedNodeId: "node-sticky-1",
    });

    await waitForCondition(() => {
      const states = bobProvider.awareness.getStates();
      for (const [, state] of states) {
        if (state?.user?.userId === aliceId && state?.cursor?.x === 250) {
          return true;
        }
      }
      return false;
    });

    console.log("  Bob received Alice's world-space cursor {x: 250, y: 350} and selection.");
    console.log("  [PASS] Collaborator presence awareness verified.\n");

    // -------------------------------------------------------------
    // CHECK 5: Object Deletion Synchronization
    // -------------------------------------------------------------
    console.log("CHECK 5: Object Deletion Synchronization (Bob deletes note)");
    bobNodes.delete("node-sticky-1");

    await waitForCondition(() => !aliceNodes.has("node-sticky-1"));
    if (aliceNodes.has("node-sticky-1")) {
      throw new Error("Deletion failed to propagate to Alice!");
    }
    console.log("  Sticky note removed from Alice's canvas. Remaining objects:", aliceNodes.size);
    console.log("  [PASS] Object deletion synchronized successfully.\n");

    // -------------------------------------------------------------
    // CHECK 6: Role-Based Access Control (Viewer Write Lock)
    // -------------------------------------------------------------
    console.log("CHECK 6: Role-Based Authorization Enforcement (Viewer Write Lock)");
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

    // Verify Dana has read access to the rectangle
    await waitForCondition(() => danaNodes.has("node-rect-2"));
    console.log("  Dana (Viewer) successfully received read access to existing canvas objects.");

    // Dana attempts to write an unauthorized node
    const unauthorizedNode: CanvasNode = {
      id: "unauthorized-viewer-node",
      workspaceId: workspaceAId,
      type: "STICKY",
      x: 999,
      y: 999,
      width: 100,
      height: 100,
      zIndex: 99,
      content: "Unauthorized edit from Viewer",
      colorId: "rose",
      authorName: "Dana Viewer",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    danaNodes.set(unauthorizedNode.id, unauthorizedNode);

    // Give time for network roundtrip
    await sleep(600);

    // Verify Alice and Bob NEVER received Dana's unauthorized node
    if (aliceNodes.has("unauthorized-viewer-node") || bobNodes.has("unauthorized-viewer-node")) {
      throw new Error("Security failure: Viewer was able to write to the shared canvas!");
    }
    console.log("  Server dropped Dana's write update. Alice and Bob remained unaffected.");
    console.log("  [PASS] Viewer write lock strictly enforced by collaboration server.\n");

    // -------------------------------------------------------------
    // CHECK 7: Workspace Isolation & Intruder Rejection
    // -------------------------------------------------------------
    console.log("CHECK 7: Workspace Scope Isolation & Intruder Rejection");
    const eveForgedToken = signCollabToken({
      userId: eveId,
      userName: "Eve Intruder",
      workspaceId: workspaceBId, // Token signed for Workspace B
      pageId: "canvas",
      canEdit: true,
      role: "OWNER",
    });

    const eveDoc = new Y.Doc();
    docsToCleanup.push(eveDoc);

    let eveRejected = false;
    let eveCloseCode = 0;

    const eveWs = new WebSocket(`${WS_BASE_URL}/${roomName}?token=${eveForgedToken}`);
    eveWs.on("close", (code) => {
      eveRejected = true;
      eveCloseCode = code;
    });

    await waitForCondition(() => eveRejected, 4000);
    if (!eveRejected || eveCloseCode !== 4403) {
      throw new Error(`Expected close code 4403, but received ${eveCloseCode}`);
    }
    console.log(`  Eve rejected with HTTP ${eveCloseCode} (Forbidden).`);
    console.log("  [PASS] Cross-workspace boundary strictly secured.\n");

    // -------------------------------------------------------------
    // CHECK 8: PostgreSQL Persistence & Server Restart Recovery
    // -------------------------------------------------------------
    console.log("CHECK 8: True PostgreSQL Persistence & Server Restart Recovery");
    // Alice adds a final persistent node
    const finalNode: CanvasNode = {
      id: "node-persistent-final",
      workspaceId: workspaceAId,
      type: "CIRCLE",
      x: 700,
      y: 300,
      width: 160,
      height: 160,
      zIndex: 15,
      content: "Persistent Circle",
      colorId: "violet",
      authorName: "Alice Owner",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    aliceNodes.set(finalNode.id, finalNode);

    // Ensure final node propagated to Bob over WebSocket first
    await waitForCondition(() => bobNodes.has("node-persistent-final"));

    console.log("  Waiting for server debounced persistence flush to PostgreSQL...");
    let savedNodes: CanvasNode[] = [];
    await waitForCondition(async () => {
      const savedCanvasInDb = await prisma.canvas.findUnique({
        where: { workspaceId: workspaceAId },
      });
      if (savedCanvasInDb && Array.isArray(savedCanvasInDb.nodes)) {
        savedNodes = savedCanvasInDb.nodes as unknown as CanvasNode[];
        return savedNodes.some((n) => n.id === "node-persistent-final");
      }
      return false;
    }, 10000, 250);

    console.log(`  Verified in PostgreSQL: ${savedNodes.length} nodes saved durably.`);

    // Simulate Server Restart: Kill server process
    console.log("  Simulating server crash / restart: Killing collaboration server process...");
    // Disconnect clients before kill
    providersToCleanup.forEach((p) => p.destroy());
    providersToCleanup.length = 0;

    killProcessTree(serverProc);
    serverProc = null;
    await sleep(1000);

    // Respawn new server on same port
    console.log("  Rebooting collaboration server on port", TEST_PORT);
    serverProc = spawn("npx", ["tsx", "collaboration-server/server.ts", String(TEST_PORT)], {
      stdio: "pipe",
      shell: true,
      env: { ...process.env, COLLAB_PORT: String(TEST_PORT), PORT: String(TEST_PORT) },
    });
    serverProc.stdout?.on("data", (d) => process.stdout.write(`[Server] ${d.toString()}`));
    serverProc.stderr?.on("data", (d) => process.stderr.write(`[ServerErr] ${d.toString()}`));
    await pollHealth(TEST_PORT);

    // A fresh client connects after server restart
    const recoveredDoc = new Y.Doc();
    docsToCleanup.push(recoveredDoc);
    const recoveredProvider = new WebsocketProvider(WS_BASE_URL, roomName, recoveredDoc, {
      params: { token: aliceToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(recoveredProvider);

    await waitForSync(recoveredProvider);
    const recoveredNodes = recoveredDoc.getMap<CanvasNode>("nodes");

    await waitForCondition(() => recoveredNodes.has("node-persistent-final"));
    if (!recoveredNodes.has("node-persistent-final")) {
      throw new Error("Recovered document failed to restore nodes from PostgreSQL!");
    }

    console.log(`  Recovered document has ${recoveredNodes.size} nodes after full restart.`);
    console.log("  [PASS] True PostgreSQL persistence and restart recovery verified.\n");

    console.log("=================================================");
    console.log("ALL PHASE 9B REAL-TIME CANVAS COLLAB CHECKS PASSED!");
    console.log("=================================================");
  } finally {
    // Teardown
    providersToCleanup.forEach((p) => p.destroy());
    docsToCleanup.forEach((d) => d.destroy());
    killProcessTree(serverProc);

    if (workspaceAId) {
      await deleteWorkspace(workspaceAId, aliceId).catch(() => {});
    }
    if (workspaceBId) {
      await deleteWorkspace(workspaceBId, eveId).catch(() => {});
    }
    if (aliceId) {
      await prisma.user.delete({ where: { id: aliceId } }).catch(() => {});
    }
    if (bobId) {
      await prisma.user.delete({ where: { id: bobId } }).catch(() => {});
    }
    if (danaId) {
      await prisma.user.delete({ where: { id: danaId } }).catch(() => {});
    }
    if (eveId) {
      await prisma.user.delete({ where: { id: eveId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runPhase9BCollabTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});

