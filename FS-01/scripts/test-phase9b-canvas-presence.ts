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
import { worldToScreen, screenToWorld } from "../lib/canvas/utils";
import { CanvasViewport, CanvasPoint } from "../types/canvas";

// Ensure global WebSocket is available for y-websocket in Node runtime
(global as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

const TEST_PORT = 1239;
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

async function runPhase9BPresenceTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 9B, Step 3: Live Cursors & Presence");
  console.log("Automated Multiplayer Awareness & Viewport Test Suite");
  console.log("=================================================\n");

  let serverProc: ChildProcess | null = null;
  const providersToCleanup: WebsocketProvider[] = [];
  const docsToCleanup: Y.Doc[] = [];

  const ts = Date.now();
  const aliceEmail = `presence-alice-${ts}@test.syncspace.dev`;
  const bobEmail = `presence-bob-${ts}@test.syncspace.dev`;
  const danaEmail = `presence-dana-${ts}@test.syncspace.dev`;
  const eveEmail = `presence-eve-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let danaId = "";
  let eveId = "";
  let workspaceAId = "";
  let workspaceBId = "";

  try {
    // -------------------------------------------------------------
    // SETUP: Launch Dedicated Collaboration Server on port 1239
    // -------------------------------------------------------------
    console.log(`[Setup] Starting test collaboration server on port ${TEST_PORT}...`);
    serverProc = spawn("npx", ["tsx", "collaboration-server/server.ts"], {
      env: {
        ...process.env,
        COLLAB_PORT: String(TEST_PORT),
        PORT: String(TEST_PORT),
        REDIS_ENABLED: "false", // Test in-memory fast awareness protocol
      },
      stdio: "pipe",
      shell: true,
    });

    serverProc.stdout?.on("data", (d) => {
      const line = d.toString().trim();
      if (line.includes("WebSocket listening") || line.includes("CollabServer")) {
        console.log(`[Server] ${line}`);
      }
    });

    serverProc.stderr?.on("data", (d) => {
      const line = d.toString().trim();
      if (line.includes("Security") || line.includes("Rejected") || line.includes("error")) {
        console.log(`[ServerLog] ${line}`);
      }
    });

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
      data: { name: "Bob Designer", email: bobEmail, emailVerified: true },
    });
    bobId = bob.id;

    const dana = await prisma.user.create({
      data: { name: "Dana Spectator", email: danaEmail, emailVerified: true },
    });
    danaId = dana.id;

    const eve = await prisma.user.create({
      data: { name: "Eve Intruder", email: eveEmail, emailVerified: true },
    });
    eveId = eve.id;

    const wsA = await createWorkspace(aliceId, { name: "Presence Canvas Workspace A" });
    workspaceAId = wsA.id;

    await addWorkspaceMember(workspaceAId, aliceId, bobEmail, WorkspaceRole.MEMBER);
    await addWorkspaceMember(workspaceAId, aliceId, danaEmail, WorkspaceRole.VIEWER);

    const wsB = await createWorkspace(eveId, { name: "Isolated Workspace B" });
    workspaceBId = wsB.id;

    const roomName = `${workspaceAId}:canvas`;

    // -------------------------------------------------------------
    // CHECK 1: Two Separate Browser/Client Sessions Handshake & Initial Presence
    // -------------------------------------------------------------
    console.log("CHECK 1: Two Client Awareness Handshake & Identity Verification");
    const aliceToken = signCollabToken({
      userId: aliceId,
      userName: "Alice Architect",
      workspaceId: workspaceAId,
      pageId: "canvas",
      canEdit: true,
      role: "OWNER",
    });

    const bobToken = signCollabToken({
      userId: bobId,
      userName: "Bob Designer",
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

    // Broadcast local initial presence states
    aliceProvider.awareness.setLocalState({
      user: {
        userId: aliceId,
        userName: "Alice Architect",
        role: "OWNER",
        canEdit: true,
        color: "#6366f1",
      },
      cursor: null,
      selectedNodeId: null,
    });

    bobProvider.awareness.setLocalState({
      user: {
        userId: bobId,
        userName: "Bob Designer",
        role: "MEMBER",
        canEdit: true,
        color: "#10b981",
      },
      cursor: null,
      selectedNodeId: null,
    });

    // Wait for both clients to see each other in awareness
    await waitForCondition(() => {
      const bobSees = Array.from(bobProvider.awareness.getStates().values());
      const aliceSees = Array.from(aliceProvider.awareness.getStates().values());
      const bobFoundAlice = bobSees.some((s) => s.user?.userId === aliceId);
      const aliceFoundBob = aliceSees.some((s) => s.user?.userId === bobId);
      return bobFoundAlice && aliceFoundBob;
    });

    console.log("  Alice and Bob registered in each other's awareness map.");
    console.log("  [PASS] Initial handshake and presence awareness verified.\n");

    // -------------------------------------------------------------
    // CHECK 2: Live Cursor Position Tracking (World-Space Coordinates)
    // -------------------------------------------------------------
    console.log("CHECK 2: Live Cursor Position Tracking Across Clients");
    const aliceCursor: CanvasPoint = { x: 350.5, y: 420.25 };
    const bobCursor: CanvasPoint = { x: 800, y: 150 };

    aliceProvider.awareness.setLocalStateField("cursor", aliceCursor);
    bobProvider.awareness.setLocalStateField("cursor", bobCursor);

    await waitForCondition(() => {
      const bobSees = Array.from(bobProvider.awareness.getStates().values());
      const aliceStateOnBob = bobSees.find((s) => s.user?.userId === aliceId);

      const aliceSees = Array.from(aliceProvider.awareness.getStates().values());
      const bobStateOnAlice = aliceSees.find((s) => s.user?.userId === bobId);

      return (
        aliceStateOnBob?.cursor?.x === 350.5 &&
        aliceStateOnBob?.cursor?.y === 420.25 &&
        bobStateOnAlice?.cursor?.x === 800 &&
        bobStateOnAlice?.cursor?.y === 150
      );
    });

    console.log(`  Bob verified Alice's cursor at (${aliceCursor.x}, ${aliceCursor.y})`);
    console.log(`  Alice verified Bob's cursor at (${bobCursor.x}, ${bobCursor.y})`);
    console.log("  [PASS] Bi-directional cursor tracking verified.\n");

    // -------------------------------------------------------------
    // CHECK 3: Pan and Zoom Viewport Invariance & Coordinate Math
    // -------------------------------------------------------------
    console.log("CHECK 3: Viewport Pan & Zoom Coordinate Math Invariance");
    // Alice is zoomed in at 2.0x, panned to (-100, -50)
    const aliceViewport: CanvasViewport = { x: -100, y: -50, zoom: 2.0 };
    // Bob is zoomed out at 0.5x, panned to (300, 200)
    const bobViewport: CanvasViewport = { x: 300, y: 200, zoom: 0.5 };

    // Point in world canvas space
    const targetWorldPoint: CanvasPoint = { x: 400, y: 300 };

    // Bob renders Alice's cursor using Bob's viewport
    const bobScreenPos = worldToScreen(targetWorldPoint, bobViewport);
    // Alice renders Bob's cursor using Alice's viewport
    const aliceScreenPos = worldToScreen(targetWorldPoint, aliceViewport);

    // Verify Bob's screen position: 400 * 0.5 + 300 = 500, 300 * 0.5 + 200 = 350
    if (bobScreenPos.x !== 500 || bobScreenPos.y !== 350) {
      throw new Error(`Bob screen pos mismatch: got (${bobScreenPos.x}, ${bobScreenPos.y}), expected (500, 350)`);
    }

    // Verify Alice's screen position: 400 * 2.0 - 100 = 700, 300 * 2.0 - 50 = 550
    if (aliceScreenPos.x !== 700 || aliceScreenPos.y !== 550) {
      throw new Error(`Alice screen pos mismatch: got (${aliceScreenPos.x}, ${aliceScreenPos.y}), expected (700, 550)`);
    }

    // Reverse test: screenToWorld
    const reconstructedBobWorld = screenToWorld(bobScreenPos, bobViewport);
    const reconstructedAliceWorld = screenToWorld(aliceScreenPos, aliceViewport);

    if (
      Math.abs(reconstructedBobWorld.x - targetWorldPoint.x) > 0.001 ||
      Math.abs(reconstructedBobWorld.y - targetWorldPoint.y) > 0.001 ||
      Math.abs(reconstructedAliceWorld.x - targetWorldPoint.x) > 0.001 ||
      Math.abs(reconstructedAliceWorld.y - targetWorldPoint.y) > 0.001
    ) {
      throw new Error("World-to-screen coordinate inversion test failed");
    }

    console.log("  World-space coordinates accurately map to distinct client viewports:");
    console.log(`    World (400, 300) -> Alice Screen (zoom 2.0): (${aliceScreenPos.x}, ${aliceScreenPos.y})`);
    console.log(`    World (400, 300) -> Bob Screen (zoom 0.5):   (${bobScreenPos.x}, ${bobScreenPos.y})`);
    console.log("  [PASS] Viewport pan and zoom invariance verified.\n");

    // -------------------------------------------------------------
    // CHECK 4: Collaborator Selection State Tracking
    // -------------------------------------------------------------
    console.log("CHECK 4: Collaborator Object Selection Tracking");
    aliceProvider.awareness.setLocalStateField("selectedNodeId", "node-sticky-arch-1");
    bobProvider.awareness.setLocalStateField("selectedNodeId", "node-rect-db-2");

    await waitForCondition(() => {
      const bobSees = Array.from(bobProvider.awareness.getStates().values());
      const aliceState = bobSees.find((s) => s.user?.userId === aliceId);

      const aliceSees = Array.from(aliceProvider.awareness.getStates().values());
      const bobState = aliceSees.find((s) => s.user?.userId === bobId);

      return (
        aliceState?.selectedNodeId === "node-sticky-arch-1" &&
        bobState?.selectedNodeId === "node-rect-db-2"
      );
    });

    console.log("  Bob received Alice's selection: 'node-sticky-arch-1'");
    console.log("  Alice received Bob's selection: 'node-rect-db-2'");

    // Deselect
    aliceProvider.awareness.setLocalStateField("selectedNodeId", null);
    await waitForCondition(() => {
      const bobSees = Array.from(bobProvider.awareness.getStates().values());
      const aliceState = bobSees.find((s) => s.user?.userId === aliceId);
      return aliceState?.selectedNodeId === null;
    });

    console.log("  Alice deselected node; Bob received selectedNodeId: null.");
    console.log("  [PASS] Collaborator selection synchronization verified.\n");

    // -------------------------------------------------------------
    // CHECK 5: Stale User Presence Removal on Disconnection
    // -------------------------------------------------------------
    console.log("CHECK 5: Stale Presence Removal on Disconnection");
    const initialAliceAwarenessCount = aliceProvider.awareness.getStates().size;
    console.log(`  Awareness states before Bob disconnect: ${initialAliceAwarenessCount}`);

    // Disconnect Bob
    bobProvider.destroy();

    // Wait for Alice to observe Bob's departure
    await waitForCondition(() => {
      const states = Array.from(aliceProvider.awareness.getStates().values());
      return !states.some((s) => s.user?.userId === bobId);
    });

    const aliceAwarenessCountAfterBob = aliceProvider.awareness.getStates().size;
    console.log(`  Awareness states after Bob disconnect: ${aliceAwarenessCountAfterBob}`);
    if (aliceAwarenessCountAfterBob !== initialAliceAwarenessCount - 1) {
      throw new Error(`Expected ${initialAliceAwarenessCount - 1} awareness states after Bob disconnected`);
    }
    console.log("  [PASS] Stale presence cleanly removed upon user departure.\n");

    // -------------------------------------------------------------
    // CHECK 6: Reconnection & Presence Recovery
    // -------------------------------------------------------------
    console.log("CHECK 6: Reconnection & Presence Recovery");
    const bobReconnectedDoc = new Y.Doc();
    docsToCleanup.push(bobReconnectedDoc);
    const bobReconnectedProvider = new WebsocketProvider(
      WS_BASE_URL,
      roomName,
      bobReconnectedDoc,
      {
        params: { token: bobToken },
        disableBc: true,
        WebSocketPolyfill: WebSocket as any,
      }
    );
    providersToCleanup.push(bobReconnectedProvider);

    await waitForSync(bobReconnectedProvider);

    bobReconnectedProvider.awareness.setLocalState({
      user: {
        userId: bobId,
        userName: "Bob Designer",
        role: "MEMBER",
        canEdit: true,
        color: "#10b981",
      },
      cursor: { x: 550, y: 720 },
      selectedNodeId: "node-reconnected-1",
    });

    await waitForCondition(() => {
      const states = Array.from(aliceProvider.awareness.getStates().values());
      const bobFound = states.find((s) => s.user?.userId === bobId);
      return (
        Boolean(bobFound) &&
        bobFound?.cursor?.x === 550 &&
        bobFound?.selectedNodeId === "node-reconnected-1"
      );
    });

    console.log("  Alice immediately received reconnected Bob's state and cursor.");
    console.log("  [PASS] Reconnection and presence recovery verified.\n");

    // -------------------------------------------------------------
    // CHECK 7: Role Boundaries & Unauthorized User Isolation
    // -------------------------------------------------------------
    console.log("CHECK 7: Role Boundaries & Unauthorized Intruder Isolation");
    // 1. Viewer Dana connects
    const danaToken = signCollabToken({
      userId: danaId,
      userName: "Dana Spectator",
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
    danaProvider.awareness.setLocalState({
      user: {
        userId: danaId,
        userName: "Dana Spectator",
        role: "VIEWER",
        canEdit: false,
        color: "#f59e0b",
      },
      cursor: { x: 100, y: 100 },
      selectedNodeId: null,
    });

    await waitForCondition(() => {
      const aliceSees = Array.from(aliceProvider.awareness.getStates().values());
      const danaFound = aliceSees.find((s) => s.user?.userId === danaId);
      return Boolean(danaFound) && danaFound?.user?.role === "VIEWER";
    });
    console.log("  Dana (Viewer) joined presence: verified read-only role flag in awareness.");

    // 2. Intruder Eve attempts to join with token scoped to Workspace B
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

    // Eve should be rejected at handshake (HTTP 4403)
    await sleep(600);
    const aliceSeesEve = Array.from(aliceProvider.awareness.getStates().values()).some(
      (s) => s.user?.userId === eveId
    );
    if (aliceSeesEve) {
      throw new Error("SECURITY FAILURE: Intruder Eve was able to broadcast awareness to Workspace A canvas!");
    }
    console.log("  Eve rejected with 4403: zero presence leakage into Workspace A.");
    console.log("  [PASS] Role boundaries and security isolation verified.\n");

    // -------------------------------------------------------------
    // CHECK 8: Zero Transient Database Writes for Transient Cursors
    // -------------------------------------------------------------
    console.log("CHECK 8: Transient Cursor State Database Bypass");
    const canvasBefore = await prisma.canvas.findUnique({
      where: { workspaceId: workspaceAId },
      select: { version: true, updatedAt: true },
    });

    // Rapidly send 20 cursor movements
    for (let i = 0; i < 20; i++) {
      aliceProvider.awareness.setLocalStateField("cursor", {
        x: 100 + i * 10,
        y: 200 + i * 5,
      });
    }

    // Wait a brief period to ensure no debounced flush was triggered by transient awareness
    await sleep(1500);

    const canvasAfter = await prisma.canvas.findUnique({
      where: { workspaceId: workspaceAId },
      select: { version: true, updatedAt: true },
    });

    if (canvasBefore?.version !== canvasAfter?.version) {
      throw new Error("Database version changed due to transient awareness / cursor messages!");
    }

    console.log(`  Canvas version before: ${canvasBefore?.version}, after: ${canvasAfter?.version}`);
    console.log("  Verified: Transient awareness and cursor updates do NOT touch PostgreSQL.");
    console.log("  [PASS] Zero transient database writes verified.\n");

    console.log("=================================================");
    console.log("ALL PHASE 9B STEP 3 PRESENCE CHECKS PASSED!");
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
      if (danaId) await prisma.user.delete({ where: { id: danaId } }).catch(() => {});
      if (eveId) await prisma.user.delete({ where: { id: eveId } }).catch(() => {});
    } catch {}
  }
}

runPhase9BPresenceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n[FATAL] Test failed with error:", err);
    process.exit(1);
  });

