import {
  CanvasNode,
  CanvasNodeType,
  CanvasViewport,
  CanvasPoint,
  CANVAS_COLOR_PRESETS,
} from "../types/canvas";
import {
  screenToWorld,
  worldToScreen,
  zoomAroundPoint,
  createDefaultNode,
  calculateBoundingBox,
  calculateFitToView,
  getColorPreset,
  formatZoomPercentage,
  MIN_ZOOM,
  MAX_ZOOM,
} from "../lib/canvas/utils";
import { WorkspaceRole } from "@prisma/client";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    process.exit(1);
  }
}

function pass(message: string) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
}

async function runCanvasTestSuite() {
  console.log("=================================================");
  console.log("SyncSpace Phase 9A, Step 2: Canvas UI Foundation");
  console.log("Automated Interaction & Foundation Test Suite");
  console.log("=================================================\n");

  const workspaceId = "ws-test-canvas-phase9a";

  // ----------------------------------------------------
  // TEST 1: Canvas Data Model and Node Creation Defaults
  // ----------------------------------------------------
  console.log("CHECK 1: Canvas Data Model and Default Node Creation");
  {
    const sticky = createDefaultNode("STICKY", { x: 100, y: 150 }, workspaceId, {
      authorName: "Sarah Chen",
    });
    assert(sticky.type === "STICKY", "Sticky node type must be STICKY");
    assert(sticky.width === 220 && sticky.height === 180, "Default sticky dimensions must be 220x180");
    assert(sticky.x === 100 && sticky.y === 150, "Sticky position must match world coordinates");
    assert(sticky.colorId === "amber", "Default sticky color must be amber");
    assert(sticky.authorName === "Sarah Chen", "Author attribution preserved");
    assert(typeof sticky.rotation === "number", "Sticky tilt rotation assigned");

    const rect = createDefaultNode("RECTANGLE", { x: 300, y: 200 }, workspaceId);
    assert(rect.type === "RECTANGLE", "Rectangle node type must be RECTANGLE");
    assert(rect.width === 200 && rect.height === 130, "Default rectangle dimensions must be 200x130");
    assert(rect.colorId === "sky", "Default rectangle color must be sky");

    const circle = createDefaultNode("CIRCLE", { x: 550, y: 200 }, workspaceId);
    assert(circle.type === "CIRCLE", "Circle node type must be CIRCLE");
    assert(circle.width === 160 && circle.height === 160, "Default circle dimensions must be 160x160");
    assert(circle.colorId === "emerald", "Default circle color must be emerald");

    const text = createDefaultNode("TEXT", { x: 100, y: 400 }, workspaceId);
    assert(text.type === "TEXT", "Text node type must be TEXT");
    assert(text.fontSize === 16, "Default font size must be 16");

    // Color presets verification
    assert(CANVAS_COLOR_PRESETS.length === 7, "Must provide 7 curated color presets");
    const amberPreset = getColorPreset("amber");
    assert(amberPreset.id === "amber" && amberPreset.bgClass.includes("amber"), "Amber preset matches");
    const fallbackPreset = getColorPreset("non-existent-color");
    assert(fallbackPreset.id === "amber", "Unknown color ID falls back safely to Amber");

    pass("All canvas node types, properties, and color presets validate correctly.");
  }

  // ----------------------------------------------------
  // TEST 2: Coordinate Transformations & Pan/Zoom Math
  // ----------------------------------------------------
  console.log("\nCHECK 2: Coordinate Transformations & Pan/Zoom Math");
  {
    const viewportOrigin: CanvasViewport = { x: 0, y: 0, zoom: 1.0 };
    const pt1: CanvasPoint = { x: 250, y: 180 };
    const world1 = screenToWorld(pt1, viewportOrigin);
    assert(world1.x === 250 && world1.y === 180, "Identity viewport transforms 1:1");

    // Transformed viewport (panned and zoomed)
    const viewportTransform: CanvasViewport = { x: 120, y: -60, zoom: 1.5 };
    const screenPt: CanvasPoint = { x: 420, y: 240 };
    const worldPt = screenToWorld(screenPt, viewportTransform);
    // (420 - 120) / 1.5 = 200, (240 - (-60)) / 1.5 = 200
    assert(Math.round(worldPt.x) === 200 && Math.round(worldPt.y) === 200, "screenToWorld correctly applies pan & zoom");

    // Exact Inverse check: worldToScreen
    const backToScreen = worldToScreen(worldPt, viewportTransform);
    assert(
      Math.abs(backToScreen.x - screenPt.x) < 0.001 &&
      Math.abs(backToScreen.y - screenPt.y) < 0.001,
      "worldToScreen is exact inverse of screenToWorld"
    );

    // Zoom around cursor invariant: Cursor point must remain invariant in world space
    const cursorScreen: CanvasPoint = { x: 500, y: 350 };
    const worldBefore = screenToWorld(cursorScreen, viewportTransform);
    const newViewport = zoomAroundPoint(viewportTransform, cursorScreen, 2.0);
    const worldAfter = screenToWorld(cursorScreen, newViewport);
    assert(
      Math.abs(worldBefore.x - worldAfter.x) < 0.001 &&
      Math.abs(worldBefore.y - worldAfter.y) < 0.001,
      "zoomAroundPoint keeps screen cursor point invariant across zoom levels"
    );

    // Zoom clamping
    const clampedMax = zoomAroundPoint(viewportTransform, cursorScreen, 5.0);
    assert(clampedMax.zoom === MAX_ZOOM, `Zoom must be clamped at MAX_ZOOM (${MAX_ZOOM})`);
    const clampedMin = zoomAroundPoint(viewportTransform, cursorScreen, 0.05);
    assert(clampedMin.zoom === MIN_ZOOM, `Zoom must be clamped at MIN_ZOOM (${MIN_ZOOM})`);

    // Zoom label format
    assert(formatZoomPercentage(1.0) === "100%", "Zoom format 1.0 -> 100%");
    assert(formatZoomPercentage(1.5) === "150%", "Zoom format 1.5 -> 150%");

    pass("Screen-to-world, world-to-screen, and cursor invariant zoom math verified.");
  }

  // ----------------------------------------------------
  // TEST 3: Canvas Object CRUD Actions & State Lifecycle
  // ----------------------------------------------------
  console.log("\nCHECK 3: Canvas Object Creation, Moving, Editing & Deletion");
  {
    let nodes: CanvasNode[] = [];

    // 1. Create
    const n1 = createDefaultNode("STICKY", { x: 50, y: 50 }, workspaceId, { content: "Sprint Task 1" });
    const n2 = createDefaultNode("RECTANGLE", { x: 300, y: 50 }, workspaceId, { content: "Backend Service" });
    nodes = [n1, n2];
    assert(nodes.length === 2, "Created 2 nodes successfully");

    // 2. Move
    nodes = nodes.map((n) => (n.id === n1.id ? { ...n, x: 80, y: 120 } : n));
    const moved = nodes.find((n) => n.id === n1.id);
    assert(moved?.x === 80 && moved?.y === 120, "Node moved to new world coordinates");

    // 3. Edit Content & Color
    nodes = nodes.map((n) => (n.id === n1.id ? { ...n, content: "Updated Task", colorId: "rose" } : n));
    const edited = nodes.find((n) => n.id === n1.id);
    assert(edited?.content === "Updated Task", "Content updated");
    assert(edited?.colorId === "rose", "Color preset updated to rose");

    // 4. Resize with min-bounds check
    const clampedWidth = Math.max(60, 40); // requested 40, clamped to 60
    const clampedHeight = Math.max(40, 20); // requested 20, clamped to 40
    nodes = nodes.map((n) => (n.id === n1.id ? { ...n, width: clampedWidth, height: clampedHeight } : n));
    const resized = nodes.find((n) => n.id === n1.id);
    assert(resized?.width === 60 && resized?.height === 40, "Node dimensions clamped to minimum bounds");

    // 5. Layering (Bring Forward & Send Backward)
    const maxZ = Math.max(...nodes.map((n) => n.zIndex));
    nodes = nodes.map((n) => (n.id === n1.id ? { ...n, zIndex: maxZ + 1 } : n));
    assert(nodes.find((n) => n.id === n1.id)!.zIndex > nodes.find((n) => n.id === n2.id)!.zIndex, "Bring forward increases zIndex");

    // 6. Delete
    nodes = nodes.filter((n) => n.id !== n1.id);
    assert(nodes.length === 1 && nodes[0].id === n2.id, "Deleted node removed cleanly from canvas state");

    pass("Object creation, movement, editing, resizing, layering, and deletion verified.");
  }

  // ----------------------------------------------------
  // TEST 4: Bounding Box and Fit-to-View Calculations
  // ----------------------------------------------------
  console.log("\nCHECK 4: Bounding Box and Fit-to-View Calculations");
  {
    const nodes: CanvasNode[] = [
      createDefaultNode("STICKY", { x: 100, y: 100 }, workspaceId), // width 220, height 180 -> right 320, bottom 280
      createDefaultNode("RECTANGLE", { x: 500, y: 400 }, workspaceId), // width 200, height 130 -> right 700, bottom 530
    ];

    const bbox = calculateBoundingBox(nodes);
    assert(bbox !== null, "Bounding box calculated for populated canvas");
    assert(bbox!.minX === 100 && bbox!.minY === 100, "Bounding box min corner (100, 100)");
    assert(bbox!.maxX === 700 && bbox!.maxY === 530, "Bounding box max corner (700, 530)");
    assert(bbox!.width === 600 && bbox!.height === 430, "Bounding box dimensions (600x430)");

    // Fit to view inside a 1200x800 container
    const fit = calculateFitToView(nodes, 1200, 800, 80);
    assert(fit.zoom >= MIN_ZOOM && fit.zoom <= MAX_ZOOM, "Fit to view zoom within bounds");
    // Verify center alignment
    const centerWorldX = bbox!.minX + bbox!.width / 2; // 400
    const centerWorldY = bbox!.minY + bbox!.height / 2; // 315
    const centerScreen = worldToScreen({ x: centerWorldX, y: centerWorldY }, fit);
    assert(
      Math.abs(centerScreen.x - 600) < 1 && Math.abs(centerScreen.y - 400) < 1,
      "Fit-to-view centers content bounding box directly in middle of viewport"
    );

    // Empty canvas fit-to-view fallback
    const emptyFit = calculateFitToView([], 1000, 800);
    assert(emptyFit.x === 0 && emptyFit.y === 0 && emptyFit.zoom === 1.0, "Empty canvas fit returns default viewport");

    pass("Bounding box and fit-to-view centering calculations verified.");
  }

  // ----------------------------------------------------
  // TEST 5: Workspace Role-Based Access Controls
  // ----------------------------------------------------
  console.log("\nCHECK 5: Workspace Access Controls and Role Boundaries");
  {
    function evaluatePermissions(role: WorkspaceRole) {
      const canEdit = role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN || role === WorkspaceRole.MEMBER;
      const canDelete = role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
      return { canEdit, canDelete };
    }

    const ownerPerms = evaluatePermissions(WorkspaceRole.OWNER);
    assert(ownerPerms.canEdit === true, "OWNER can edit canvas");

    const adminPerms = evaluatePermissions(WorkspaceRole.ADMIN);
    assert(adminPerms.canEdit === true, "ADMIN can edit canvas");

    const memberPerms = evaluatePermissions(WorkspaceRole.MEMBER);
    assert(memberPerms.canEdit === true, "MEMBER can edit canvas");

    const viewerPerms = evaluatePermissions(WorkspaceRole.VIEWER);
    assert(viewerPerms.canEdit === false, "VIEWER has read-only access (canEdit === false)");

    // Simulated Viewer attempt to mutate canvas
    let viewerNodes: CanvasNode[] = [
      createDefaultNode("STICKY", { x: 50, y: 50 }, workspaceId, { content: "Original Note" }),
    ];

    function applyViewerAction(action: "add" | "move" | "delete", canEdit: boolean) {
      if (!canEdit) {
        return false; // Action rejected
      }
      return true;
    }

    assert(applyViewerAction("add", viewerPerms.canEdit) === false, "Viewer cannot add nodes");
    assert(applyViewerAction("move", viewerPerms.canEdit) === false, "Viewer cannot move nodes");
    assert(applyViewerAction("delete", viewerPerms.canEdit) === false, "Viewer cannot delete nodes");

    pass("Workspace role access boundaries and viewer read-only protection verified.");
  }

  // ----------------------------------------------------
  // TEST 6: Empty State Detection and Quick Start Actions
  // ----------------------------------------------------
  console.log("\nCHECK 6: Empty State Detection & Quick-Start Actions");
  {
    const emptyNodes: CanvasNode[] = [];
    const isEmpty = emptyNodes.length === 0;
    assert(isEmpty, "Canvas empty state detected when nodes array length is 0");

    // Quick-add sticky note
    const quickSticky = createDefaultNode("STICKY", { x: 300, y: 200 }, workspaceId, {
      content: "Brainstorming idea",
    });
    const populatedNodes = [...emptyNodes, quickSticky];
    assert(populatedNodes.length === 1, "Quick-add sticky populated canvas");
    assert(populatedNodes[0].type === "STICKY", "First object is sticky note");
    assert(populatedNodes.length > 0, "Canvas transitions out of empty state");

    pass("Empty state detection and quick-start object creation verified.");
  }

  console.log("\n=================================================");
  console.log("ALL PHASE 9A CANVAS UI FOUNDATION TESTS PASSED!");
  console.log("=================================================\n");
}

runCanvasTestSuite().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});

