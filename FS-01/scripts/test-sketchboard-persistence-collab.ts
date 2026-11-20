import "dotenv/config";
import "../src/lib/dns-fallback";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { prisma } from "../src/lib/db/prisma";
import {
  getSketchboardForWorkspace,
  saveSketchboardForWorkspace,
  SketchboardConflictError,
} from "../src/lib/services/sketchboard";
import { WorkspaceError } from "../src/lib/services/workspace";
import { signCollabToken } from "../src/lib/collaboration/token";
import { WorkspaceRole } from "@prisma/client";
import { SketchElement } from "../types/sketchboard";

// Ensure global WebSocket is available for y-websocket in Node runtime
(global as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

const COLLAB_PORT = 1234;
const WS_ENDPOINT = `ws://127.0.0.1:${COLLAB_PORT}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    process.exit(1);
  }
}

function pass(message: string) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForSync(provider: WebsocketProvider, timeoutMs = 8000): Promise<void> {
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

async function runPrompt2TestSuite() {
  console.log("=================================================");
  console.log("SyncSpace Sketchboard Prompt 2 Verification Suite");
  console.log("Persistence & Real-Time Collaboration Tests");
  console.log("=================================================\n");

  const ts = Date.now();
  const aliceEmail = `alice-sketch-${ts}@test.syncspace.dev`;
  const bobEmail = `bob-sketch-${ts}@test.syncspace.dev`;
  const victorEmail = `victor-sketch-${ts}@test.syncspace.dev`;
  const eveEmail = `eve-sketch-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let victorId = "";
  let eveId = "";
  let workspaceId = "";

  try {
    // ----------------------------------------------------
    // SETUP: Provision Test Users and Workspace in PostgreSQL
    // ----------------------------------------------------
    console.log("[Setup] Provisioning test users and workspace in PostgreSQL...");
    const alice = await prisma.user.create({
      data: { name: "Alice Owner", email: aliceEmail, emailVerified: true },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: { name: "Bob Member", email: bobEmail, emailVerified: true },
    });
    bobId = bob.id;

    const victor = await prisma.user.create({
      data: { name: "Victor Viewer", email: victorEmail, emailVerified: true },
    });
    victorId = victor.id;

    const eve = await prisma.user.create({
      data: { name: "Eve Intruder", email: eveEmail, emailVerified: true },
    });
    eveId = eve.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `Sketchboard Collab Workspace ${ts}`,
        ownerId: aliceId,
        members: {
          create: [
            { userId: aliceId, role: WorkspaceRole.OWNER },
            { userId: bobId, role: WorkspaceRole.MEMBER },
            { userId: victorId, role: WorkspaceRole.VIEWER },
          ],
        },
      },
    });
    workspaceId = workspace.id;
    pass("Test workspace and users provisioned.\n");

    // ----------------------------------------------------
    // TEST 1: Create a Board & Add Objects (PostgreSQL)
    // ----------------------------------------------------
    console.log("TEST 1: Creating a board and persisting initial objects...");
    const initialElements: SketchElement[] = [
      {
        id: "el_rect_1",
        type: "RECTANGLE",
        x: 100,
        y: 100,
        width: 180,
        height: 100,
        zIndex: 1,
        strokeColor: "#0284c7",
        fillColor: "transparent",
        strokeWidth: 2,
        strokeStyle: "solid",
        opacity: 1,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: "el_sticky_1",
        type: "STICKY",
        x: 350,
        y: 100,
        width: 200,
        height: 180,
        zIndex: 2,
        strokeColor: "#fed7aa",
        fillColor: "#ffedd5",
        text: "Real-time architecture brainstorming note",
        fontSize: 16,
        textAlign: "left",
        textColor: "#9a3412",
        authorName: "Alice Owner",
        strokeWidth: 1,
        strokeStyle: "solid",
        opacity: 1,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: "el_pen_1",
        type: "PEN",
        x: 60,
        y: 60,
        width: 1,
        height: 1,
        zIndex: 3,
        strokeColor: "#0f172a",
        fillColor: "transparent",
        strokeWidth: 3,
        strokeStyle: "solid",
        opacity: 1,
        points: [
          { x: 60, y: 60 },
          { x: 70, y: 80 },
          { x: 90, y: 100 },
        ],
        createdAt: ts,
        updatedAt: ts,
      },
    ];

    const savedRecord = await saveSketchboardForWorkspace(workspaceId, aliceId, {
      name: "Engineering Architecture Board",
      elements: initialElements,
      viewport: { x: 0, y: 0, zoom: 1.0 },
      gridMode: "dots",
      canvasBg: "white",
    });

    assert(savedRecord.elements.length === 3, "Initial elements count should be 3");
    assert(savedRecord.name === "Engineering Architecture Board", "Board name mismatch");
    assert(savedRecord.version === 1, "Initial version should be 1");
    pass("Board created and objects persisted to PostgreSQL.\n");

    // ----------------------------------------------------
    // TEST 2 & 3: Refresh & Reopen Board (Simulate Logout/Login)
    // ----------------------------------------------------
    console.log("TEST 2 & 3: Refreshing and reopening board across user sessions...");
    // Simulate Bob logging in and opening the board
    const loadedForBob = await getSketchboardForWorkspace(workspaceId, bobId);
    assert(loadedForBob !== null, "Board should be accessible to Bob");
    assert(loadedForBob?.elements.length === 3, "Loaded elements count should match persisted 3 elements");
    assert(loadedForBob?.name === "Engineering Architecture Board", "Persisted name should match");
    assert(loadedForBob?.canEdit === true, "Bob should have canEdit: true as MEMBER");

    // Verify all properties of sticky note preserved
    const loadedSticky = loadedForBob?.elements.find((e) => e.id === "el_sticky_1");
    assert(loadedSticky?.text === "Real-time architecture brainstorming note", "Sticky note text lost on reload");
    assert(loadedSticky?.authorName === "Alice Owner", "Author name lost on reload");

    pass("Board reliably loaded after refresh, logout, and login without data loss.\n");

    // ----------------------------------------------------
    // TEST 4: Open Same Board in Two Browser Sessions (Yjs WebSocket)
    // ----------------------------------------------------
    console.log("TEST 4: Connecting two concurrent clients (Alice & Bob) to Yjs collaboration room...");
    const roomName = `${workspaceId}:sketchboard`;

    const aliceToken = signCollabToken({
      userId: aliceId,
      userName: "Alice Owner",
      workspaceId,
      pageId: "sketchboard",
      canEdit: true,
      role: "OWNER",
    });

    const bobToken = signCollabToken({
      userId: bobId,
      userName: "Bob Member",
      workspaceId,
      pageId: "sketchboard",
      canEdit: true,
      role: "MEMBER",
    });

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const providerA = new WebsocketProvider(WS_ENDPOINT, roomName, docA, {
      params: { token: aliceToken },
      disableBc: true,
    });

    const providerB = new WebsocketProvider(WS_ENDPOINT, roomName, docB, {
      params: { token: bobToken },
      disableBc: true,
    });

    await Promise.all([waitForSync(providerA), waitForSync(providerB)]);
    pass("Client A and Client B synchronized with collaboration room.\n");

    // ----------------------------------------------------
    // TEST 5 & 6: Simultaneous Drawing & Real-Time Sync
    // ----------------------------------------------------
    console.log("TEST 5 & 6: Drawing simultaneously from both sessions & verifying real-time sync...");
    const yElementsA = docA.getMap<SketchElement>("elements");
    const yElementsB = docB.getMap<SketchElement>("elements");

    // Alice draws a diamond
    const diamondFromA: SketchElement = {
      id: "el_diamond_A",
      type: "DIAMOND",
      x: 500,
      y: 200,
      width: 140,
      height: 140,
      zIndex: 4,
      strokeColor: "#8b5cf6",
      fillColor: "#f3e8ff",
      strokeWidth: 2,
      strokeStyle: "solid",
      opacity: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Bob draws a connector connecting to Alice's diamond
    const connectorFromB: SketchElement = {
      id: "el_connector_B",
      type: "CONNECTOR",
      x: 350,
      y: 200,
      width: 150,
      height: 50,
      zIndex: 5,
      strokeColor: "#10b981",
      fillColor: "transparent",
      strokeWidth: 2,
      strokeStyle: "solid",
      opacity: 1,
      startPoint: { x: 350, y: 200 },
      endPoint: { x: 500, y: 270 },
      arrowEnd: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Commit both concurrently
    docA.transact(() => {
      yElementsA.set(diamondFromA.id, diamondFromA);
    }, "clientA-draw");

    docB.transact(() => {
      yElementsB.set(connectorFromB.id, connectorFromB);
    }, "clientB-draw");

    // Allow websocket roundtrip propagation (~200ms)
    await sleep(400);

    // Verify Bob received Alice's diamond
    const bobReceivedDiamond = yElementsB.get("el_diamond_A");
    assert(bobReceivedDiamond !== undefined, "Bob did not receive Alice's diamond in real time");
    assert(bobReceivedDiamond?.strokeColor === "#8b5cf6", "Diamond properties corrupted across peer sync");

    // Verify Alice received Bob's connector
    const aliceReceivedConnector = yElementsA.get("el_connector_B");
    assert(aliceReceivedConnector !== undefined, "Alice did not receive Bob's connector in real time");
    assert(aliceReceivedConnector?.arrowEnd === true, "Connector arrowEnd property mismatch");

    pass("Conflict-free simultaneous drawing synchronized across sessions in real time.\n");

    // ----------------------------------------------------
    // TEST 7: Collaborator Cursors and Live Presence
    // ----------------------------------------------------
    console.log("TEST 7: Testing live collaborator cursors and presence broadcasting...");

    // Alice sets cursor position in Awareness
    providerA.awareness.setLocalState({
      user: {
        userId: aliceId,
        userName: "Alice Owner",
        role: "OWNER",
        color: "#0284c7",
        canEdit: true,
      },
      cursor: { x: 420, y: 180 },
      selectedIds: ["el_diamond_A"],
    });

    await sleep(200);

    // Check Bob's awareness states
    const statesInB = providerB.awareness.getStates();
    const aliceStateInB = Array.from(statesInB.values()).find(
      (s: any) => s.user?.userId === aliceId
    );

    assert(aliceStateInB !== undefined, "Alice presence state not found in Bob's awareness");
    assert(aliceStateInB?.cursor?.x === 420 && aliceStateInB?.cursor?.y === 180, "Cursor coordinate mismatch in peer view");
    assert(aliceStateInB?.selectedIds?.[0] === "el_diamond_A", "Peer selection state mismatch");

    pass("Live cursor coordinates and user presence successfully broadcast to peers.\n");

    // ----------------------------------------------------
    // TEST 8 & 9: Disconnect, Reconnect & Durable Persistence
    // ----------------------------------------------------
    console.log("TEST 8 & 9: Simulating temporary network drop, reconnect, and durable save...");

    // Disconnect Alice temporarily
    providerA.disconnect();
    assert(!providerA.wsconnected, "Provider A should be disconnected");

    // While Alice is disconnected, Bob adds a note
    const offlineNoteFromB: SketchElement = {
      id: "el_offline_note",
      type: "TEXT",
      x: 700,
      y: 100,
      width: 150,
      height: 40,
      zIndex: 6,
      strokeColor: "transparent",
      fillColor: "transparent",
      strokeWidth: 1,
      strokeStyle: "solid",
      opacity: 1,
      text: "Added while Alice offline",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    docB.transact(() => {
      yElementsB.set(offlineNoteFromB.id, offlineNoteFromB);
    });

    // Reconnect Alice
    providerA.connect();
    await waitForSync(providerA);

    // Alice must receive the note created while disconnected
    const aliceReceivedOfflineNote = yElementsA.get("el_offline_note");
    assert(aliceReceivedOfflineNote !== undefined, "Alice did not receive offline change upon reconnection");
    assert(aliceReceivedOfflineNote?.text === "Added while Alice offline", "Offline note text corrupted");

    pass("Reconnection after temporary failure completed without data loss.\n");

    // Cleanup providers
    providerA.destroy();
    providerB.destroy();
    docA.destroy();
    docB.destroy();

    // ----------------------------------------------------
    // TEST 10: Security and Workspace Permission Boundaries
    // ----------------------------------------------------
    console.log("TEST 10: Testing security boundaries and unauthorized access...");

    // 10A: Viewer should be rejected on REST save (HTTP 403)
    let viewerSaveRejected = false;
    try {
      await saveSketchboardForWorkspace(workspaceId, victorId, {
        elements: initialElements,
      });
    } catch (err) {
      if (err instanceof WorkspaceError && err.status === 403) {
        viewerSaveRejected = true;
      }
    }
    assert(viewerSaveRejected, "Victor Viewer should be rejected on save with 403");

    // 10B: Intruder Eve (non-member) should be rejected on read and write (HTTP 404 / 403)
    let eveReadRejected = false;
    const eveResult = await getSketchboardForWorkspace(workspaceId, eveId);
    if (eveResult === null) {
      eveReadRejected = true;
    }
    assert(eveReadRejected, "Eve Intruder must not be able to read sketchboard from unrelated workspace");

    // 10C: Forged / cross-workspace token rejection
    const forgedToken = signCollabToken({
      userId: eveId,
      userName: "Eve Intruder",
      workspaceId: "unrelated_workspace_999",
      pageId: "sketchboard",
      canEdit: true,
      role: "OWNER",
    });

    const forgedDoc = new Y.Doc();
    const forgedProvider = new WebsocketProvider(WS_ENDPOINT, roomName, forgedDoc, {
      params: { token: forgedToken },
      disableBc: true,
    });

    let forgedConnectionClosed = false;
    await new Promise<void>((resolve) => {
      forgedProvider.on("connection-close", (event: any) => {
        if (event && (event.code === 4403 || event.code === 4404 || event.code === 4401)) {
          forgedConnectionClosed = true;
          resolve();
        }
      });
      setTimeout(() => resolve(), 2000);
    });

    forgedProvider.destroy();
    forgedDoc.destroy();
    assert(forgedConnectionClosed, "Forged token connection was not rejected with security error code");

    pass("Security, permissions, and workspace boundaries rigorously enforced.\n");

    console.log("=================================================");
    console.log("ALL 10 PROMPT 2 VERIFICATION TESTS PASSED!");
    console.log("=================================================");
  } finally {
    // ----------------------------------------------------
    // CLEANUP: Clean up test workspace and users from PostgreSQL
    // ----------------------------------------------------
    console.log("\n[Cleanup] Removing temporary test records...");
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    if (aliceId) await prisma.user.delete({ where: { id: aliceId } }).catch(() => {});
    if (bobId) await prisma.user.delete({ where: { id: bobId } }).catch(() => {});
    if (victorId) await prisma.user.delete({ where: { id: victorId } }).catch(() => {});
    if (eveId) await prisma.user.delete({ where: { id: eveId } }).catch(() => {});
    console.log("[Cleanup] Complete.");
  }
}

runPrompt2TestSuite().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});

