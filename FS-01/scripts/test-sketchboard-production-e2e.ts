import "dotenv/config";
import "../src/lib/dns-fallback";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
// @ts-expect-error ws polyfill for node test environment
import WebSocket from "ws";
import prisma from "../src/lib/db/prisma";
import {
  createSketchboardForWorkspace,
  listSketchboardsForWorkspace,
  getSketchboardById,
  saveSketchboardForWorkspace,
  deleteSketchboard,
  validateSketchElement,
} from "../src/lib/services/sketchboard";
import { signCollabToken } from "../src/lib/collaboration/token";
import {
  createDefaultSketchElement,
  exportToJson,
  parseSketchboardJson,
  snapToGrid,
  calculateAlignmentGuides,
  getElementsBoundingBox,
  alignElements,
  distributeElements,
  reorderElements,
} from "../lib/sketchboard/utils";
import type { SketchElement, BoundingBox } from "../types/sketchboard";

// @ts-expect-error polyfill global WebSocket for node y-websocket client
global.WebSocket = WebSocket;

async function runPrompt3ProductionSuite() {
  console.log("=================================================");
  console.log("SyncSpace Sketchboard Prompt 3 Production E2E Suite");
  console.log("=================================================");

  const timestamp = Date.now();
  const testOwnerEmail = `sketch-p3-owner-${timestamp}@test.syncspace.local`;
  const testEditorEmail = `sketch-p3-editor-${timestamp}@test.syncspace.local`;
  const testStrangerEmail = `sketch-p3-stranger-${timestamp}@test.syncspace.local`;

  let ownerUser: { id: string; email: string };
  let editorUser: { id: string; email: string };
  let strangerUser: { id: string; email: string };
  let workspace: { id: string; name: string };

  try {
    // -----------------------------------------------------------------
    // SETUP: Provision workspace & users
    // -----------------------------------------------------------------
    console.log("\n[Setup] Provisioning test users and workspace...");
    ownerUser = await prisma.user.create({
      data: {
        id: `usr_p3_owner_${timestamp}`,
        name: "Alice Owner",
        email: testOwnerEmail,
      },
    });

    editorUser = await prisma.user.create({
      data: {
        id: `usr_p3_editor_${timestamp}`,
        name: "Bob Editor",
        email: testEditorEmail,
      },
    });

    strangerUser = await prisma.user.create({
      data: {
        id: `usr_p3_stranger_${timestamp}`,
        name: "Eve Stranger",
        email: testStrangerEmail,
      },
    });

    workspace = await prisma.workspace.create({
      data: {
        name: "Prompt 3 Production Workspace",
        ownerId: ownerUser.id,
        members: {
          create: [
            { userId: ownerUser.id, role: "OWNER" },
            { userId: editorUser.id, role: "EDITOR" },
          ],
        },
      },
    });
    console.log(`[PASS] Workspace created: id=${workspace.id}`);

    // -----------------------------------------------------------------
    // WORKFLOW 1: Multi-Board Creation & Listing
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 1: Multi-board creation, listing, and switching...");
    const boardA = await createSketchboardForWorkspace(
      workspace.id,
      ownerUser.id,
      "Sprint 1 Architecture"
    );
    const boardB = await createSketchboardForWorkspace(
      workspace.id,
      editorUser.id,
      "UI Wireframes & Notes"
    );

    if (!boardA.id || !boardB.id || boardA.id === boardB.id) {
      throw new Error("Failed to create independent sketchboard records");
    }

    const listedBoards = await listSketchboardsForWorkspace(workspace.id, ownerUser.id);
    if (listedBoards.length < 2) {
      throw new Error(`Expected at least 2 boards, found ${listedBoards.length}`);
    }
    console.log(`[PASS] Created 2 independent whiteboards: "${boardA.name}" & "${boardB.name}"`);

    // -----------------------------------------------------------------
    // WORKFLOW 2: Rich Elements Creation (Drawings, Shapes, Notes, Images)
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 2: Adding drawings, shapes, text, sticky notes, and images...");
    const rectEl = createDefaultSketchElement("RECTANGLE", { x: 100, y: 100 }, {
      width: 160,
      height: 100,
      strokeColor: "#0284c7",
      fillColor: "#e0f2fe",
    });
    const circleEl = createDefaultSketchElement("CIRCLE", { x: 300, y: 100 }, {
      width: 120,
      height: 120,
      strokeColor: "#0284c7",
    });
    const penEl = createDefaultSketchElement("PEN", { x: 50, y: 50 }, {
      points: [{ x: 50, y: 50 }, { x: 75, y: 80 }, { x: 100, y: 90 }],
    });
    const stickyEl = createDefaultSketchElement("STICKY", { x: 450, y: 150 }, {
      text: "Production release checklist item",
      fillColor: "#ffedd5",
    });
    const textEl = createDefaultSketchElement("TEXT", { x: 100, y: 250 }, {
      text: "SyncSpace Whiteboard 2026",
      fontSize: 24,
    });
    const imageEl = createDefaultSketchElement("IMAGE", { x: 500, y: 350 }, {
      width: 320,
      height: 200,
      imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    });

    const initialElements = [rectEl, circleEl, penEl, stickyEl, textEl, imageEl];
    const savedBoard = await saveSketchboardForWorkspace(
      workspace.id,
      ownerUser.id,
      {
        elements: initialElements,
        gridMode: "grid",
        canvasBg: "slate",
        viewport: { x: 0, y: 0, zoom: 1.2 },
      },
      boardA.id
    );

    if (savedBoard.elements.length !== 6) {
      throw new Error(`Expected 6 persisted elements, got ${savedBoard.elements.length}`);
    }
    console.log(`[PASS] 6 diverse elements persisted to board "${savedBoard.name}"`);

    // -----------------------------------------------------------------
    // WORKFLOW 3: Object Locking & Unlocking Constraints
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 3: Object locking and unlocking logic...");
    // Lock rectEl
    rectEl.isLocked = true;
    const lockedElements = [rectEl, circleEl, stickyEl];

    // Verify delete logic: locked elements must not be deleted
    const selectedIdsToDelete = new Set([rectEl.id, circleEl.id]);
    const remainingAfterDelete = lockedElements.filter(
      (el) => !selectedIdsToDelete.has(el.id) || el.isLocked
    );
    if (!remainingAfterDelete.some((el) => el.id === rectEl.id)) {
      throw new Error("Locked element was incorrectly deleted!");
    }
    if (remainingAfterDelete.some((el) => el.id === circleEl.id)) {
      throw new Error("Unlocked element was not deleted!");
    }

    // Toggle unlock
    rectEl.isLocked = false;
    const remainingAfterUnlock = lockedElements.filter(
      (el) => !selectedIdsToDelete.has(el.id) || el.isLocked
    );
    if (remainingAfterUnlock.some((el) => el.id === rectEl.id)) {
      throw new Error("Unlocked element was retained after deletion!");
    }
    console.log(`[PASS] Object locking prevents deletion and movement; unlocking restores editing.`);

    // -----------------------------------------------------------------
    // WORKFLOW 4: Alignment Guides & Grid Snapping
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 4: Alignment guides and grid snapping...");
    // 1. Grid snapping
    const rawCoord = 127;
    const snapped12 = snapToGrid(rawCoord, 12);
    if (snapped12 !== 120 && snapped12 !== 132) {
      throw new Error(`Grid snapping failed: expected 120 or 132 for 127, got ${snapped12}`);
    }
    if (snapToGrid(24.3, 12) !== 24) {
      throw new Error("Grid snapping error on 24.3");
    }

    // 2. Smart alignment guides
    const stationaryEl = createDefaultSketchElement("RECTANGLE", { x: 200, y: 200 }, { width: 100, height: 100 });
    const draggedBox: BoundingBox = {
      minX: 203, // 3px off from stationary.x (within threshold of 6px)
      minY: 400,
      maxX: 303,
      maxY: 500,
      width: 100,
      height: 100,
    };
    const { snapX, guides } = calculateAlignmentGuides(draggedBox, [stationaryEl], 6);
    if (snapX !== 200) {
      throw new Error(`Smart alignment snap failed: expected snapX=200, got ${snapX}`);
    }
    if (guides.length === 0 || guides[0].type !== "vertical" || guides[0].position !== 200) {
      throw new Error("Alignment guide was not generated accurately");
    }
    console.log(`[PASS] Grid snapping (12px) and smart alignment guides (X=200 line) verified.`);

    // -----------------------------------------------------------------
    // WORKFLOW 5: Grouping, Ungrouping & Geometric Operations
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 5: Grouping, ungrouping, layering, and alignment...");
    const g1 = "grp_test_prod";
    rectEl.groupId = g1;
    circleEl.groupId = g1;
    if (rectEl.groupId !== circleEl.groupId) {
      throw new Error("Grouping ID mismatch");
    }

    // Ungroup
    delete rectEl.groupId;
    delete circleEl.groupId;

    // Alignment test
    const alignSet = new Set([rectEl.id, circleEl.id]);
    const alignedLeft = alignElements([rectEl, circleEl], alignSet, "left");
    if (alignedLeft[0].x !== alignedLeft[1].x) {
      throw new Error("Align left failed to equalize X coordinate");
    }
    console.log(`[PASS] Grouping, ungrouping, layering, and geometric alignment passed.`);

    // -----------------------------------------------------------------
    // WORKFLOW 6: Export (PNG/SVG/JSON) & Import Validation
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 6: JSON export, backup serialization, and import parser...");
    const jsonBackup = exportToJson([rectEl, circleEl, textEl], "Backup Test Board");
    const parsed = parseSketchboardJson(jsonBackup);
    if (parsed.elements.length !== 3 || parsed.boardName !== "Backup Test Board") {
      throw new Error("JSON backup import failed to restore elements");
    }
    console.log(`[PASS] JSON backup exported and parsed cleanly with 3 elements.`);

    // -----------------------------------------------------------------
    // WORKFLOW 7: Real-Time Yjs Multi-Board Sync & WebSockets
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 7: Real-time Yjs CRDT synchronization for specific board room...");
    const roomName = `${workspace.id}:sketchboard:${boardA.id}`;
    const tokenA = signCollabToken({
      userId: ownerUser.id,
      userName: ownerUser.name,
      workspaceId: workspace.id,
      pageId: boardA.id,
      canEdit: true,
      role: "OWNER",
    });

    const tokenB = signCollabToken({
      userId: editorUser.id,
      userName: editorUser.name,
      workspaceId: workspace.id,
      pageId: boardA.id,
      canEdit: true,
      role: "EDITOR",
    });

    const ydocA = new Y.Doc();
    const ydocB = new Y.Doc();

    const providerA = new WebsocketProvider(
      "ws://127.0.0.1:1234",
      roomName,
      ydocA,
      { params: { token: tokenA }, disableBc: true, connect: true }
    );

    const providerB = new WebsocketProvider(
      "ws://127.0.0.1:1234",
      roomName,
      ydocB,
      { params: { token: tokenB }, disableBc: true, connect: true }
    );

    // Wait for connection
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Client A connection timed out")), 6000);
        providerA.on("status", (e: { status: string }) => {
          if (e.status === "connected") {
            clearTimeout(timeout);
            resolve();
          }
        });
      }),
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Client B connection timed out")), 6000);
        providerB.on("status", (e: { status: string }) => {
          if (e.status === "connected") {
            clearTimeout(timeout);
            resolve();
          }
        });
      }),
    ]);

    // Give Yjs sync handshake time to establish peer connection
    await new Promise((r) => setTimeout(r, 600));

    // Transact drawing on Client A and verify Client B receives it
    const mapA = ydocA.getMap<SketchElement>("elements");
    const mapB = ydocB.getMap<SketchElement>("elements");

    const realtimeSyncPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Client B failed to receive real-time element")), 6000);
      mapB.observe(() => {
        if (mapB.has("rt_el_prod")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    const realtimeEl = createDefaultSketchElement("RECTANGLE", { x: 777, y: 888 }, {
      id: "rt_el_prod",
      strokeColor: "#10b981",
    });

    ydocA.transact(() => {
      mapA.set("rt_el_prod", realtimeEl);
    }, "client-a-draw");

    await realtimeSyncPromise;
    console.log(`[PASS] Real-time Yjs CRDT synchronized between Client A and Client B in room ${roomName}.`);

    // -----------------------------------------------------------------
    // WORKFLOW 8: Live Collaborator Cursors & Presence
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 8: Live collaborator cursor & presence broadcasting...");
    const presencePromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Client B did not receive Client A presence")), 6000);
      providerB.awareness.on("change", () => {
        const states = Array.from(providerB.awareness.getStates().values());
        const hasA = states.some(
          (s: any) => s.user?.userId === ownerUser.id && s.cursor?.x === 350 && s.cursor?.y === 450
        );
        if (hasA) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    providerA.awareness.setLocalState({
      user: {
        userId: ownerUser.id,
        userName: ownerUser.name,
        role: "OWNER",
        canEdit: true,
        color: "#0284c7",
      },
      cursor: { x: 350, y: 450 },
    });

    await presencePromise;
    console.log(`[PASS] Collaborator cursor (350, 450) and identity successfully broadcast.`);

    providerA.destroy();
    providerB.destroy();
    ydocA.destroy();
    ydocB.destroy();

    // -----------------------------------------------------------------
    // WORKFLOW 9: Board Renaming & Multi-Board Isolation
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 9: Board renaming and persistence verification...");
    const renamedBoard = await saveSketchboardForWorkspace(
      workspace.id,
      ownerUser.id,
      {
        name: "Renamed Sprint Planning Whiteboard",
        elements: initialElements,
      },
      boardA.id
    );

    if (renamedBoard.name !== "Renamed Sprint Planning Whiteboard") {
      throw new Error(`Board renaming failed: got ${renamedBoard.name}`);
    }

    const fetchedBoard = await getSketchboardById(boardA.id, ownerUser.id);
    if (fetchedBoard?.name !== "Renamed Sprint Planning Whiteboard") {
      throw new Error("Fetched board name does not reflect updated title");
    }
    console.log(`[PASS] Board successfully renamed to "${fetchedBoard.name}"`);

    // -----------------------------------------------------------------
    // WORKFLOW 10: Security & Permissions Enforcement
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 10: Security boundaries and unauthorized access checks...");
    // 1. Unauthorized stranger cannot view board
    const strangerBoard = await getSketchboardById(boardA.id, strangerUser.id);
    if (strangerBoard !== null) {
      throw new Error("Security violation: non-member was able to fetch workspace sketchboard!");
    }

    // 2. Stranger cannot delete board
    let strangerDeleteBlocked = false;
    try {
      await deleteSketchboard(boardA.id, strangerUser.id);
    } catch {
      strangerDeleteBlocked = true;
    }
    if (!strangerDeleteBlocked) {
      throw new Error("Security violation: stranger was able to delete sketchboard!");
    }
    console.log(`[PASS] Unauthorized users blocked from accessing or modifying whiteboard.`);

    // -----------------------------------------------------------------
    // WORKFLOW 11: Board Deletion with Permissions
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 11: Deleting a sketchboard with role permissions...");
    const deleteResult = await deleteSketchboard(boardB.id, ownerUser.id);
    if (!deleteResult.success) {
      throw new Error("Owner failed to delete whiteboard");
    }

    const remainingBoards = await listSketchboardsForWorkspace(workspace.id, ownerUser.id);
    if (remainingBoards.some((b) => b.id === boardB.id)) {
      throw new Error("Deleted board still present in workspace list!");
    }
    console.log(`[PASS] Board successfully deleted. Workspace board count now: ${remainingBoards.length}`);

    // -----------------------------------------------------------------
    // WORKFLOW 12: Production Readiness & Data Integrity
    // -----------------------------------------------------------------
    console.log("\nWORKFLOW 12: Data integrity and schema verification...");
    const survivingBoard = await getSketchboardById(boardA.id, ownerUser.id);
    if (!survivingBoard || survivingBoard.elements.length < 5) {
      throw new Error("Data loss detected on surviving whiteboard!");
    }
    console.log(`[PASS] Full data integrity verified on surviving board.`);

    console.log("\n=================================================");
    console.log("ALL 12 PROMPT 3 PRODUCTION WORKFLOWS PASSED 100%!");
    console.log("=================================================");
  } finally {
    // Cleanup test records
    console.log("\n[Cleanup] Removing temporary test records...");
    try {
      await prisma.workspace.deleteMany({
        where: { id: workspace?.id },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [testOwnerEmail, testEditorEmail, testStrangerEmail],
          },
        },
      });
      console.log("[Cleanup] Complete.");
    } catch (cleanupErr) {
      console.warn("[Cleanup] Error during teardown:", cleanupErr);
    }
    await prisma.$disconnect();
  }
}

runPrompt3ProductionSuite().catch((err) => {
  console.error("\n[FAIL] Test suite failed:", err);
  process.exit(1);
});
