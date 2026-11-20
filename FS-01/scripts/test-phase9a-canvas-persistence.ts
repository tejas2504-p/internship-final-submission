import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import {
  getCanvasForWorkspace,
  saveCanvasForWorkspace,
  CanvasConflictError,
  MAX_CANVAS_NODES,
} from "../src/lib/services/canvas";
import { WorkspaceError } from "../src/lib/services/workspace";
import { CanvasNode, CanvasNodeType } from "../types/canvas";
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

async function runPersistenceTestSuite() {
  console.log("=================================================");
  console.log("SyncSpace Phase 9A, Step 3: Persistent Canvas Storage");
  console.log("PostgreSQL & Prisma Integration & Concurrency Test");
  console.log("=================================================\n");

  const ts = Date.now();
  const aliceEmail = `alice-persist-${ts}@test.syncspace.dev`;
  const bobEmail = `bob-persist-${ts}@test.syncspace.dev`;
  const victorEmail = `victor-persist-${ts}@test.syncspace.dev`;
  const eveEmail = `eve-persist-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let victorId = "";
  let eveId = "";
  let workspaceId = "";

  try {
    // ----------------------------------------------------
    // SETUP: Provision Test Users and Workspace
    // ----------------------------------------------------
    console.log("[Setup] Provisioning test users and workspace...");
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
        name: `Canvas Test Workspace ${ts}`,
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
    console.log(`[Setup] Provisioned workspace: ${workspaceId}\n`);

    // ----------------------------------------------------
    // CHECK 1: Initial Canvas Loading & Authorization Scoping
    // ----------------------------------------------------
    console.log("CHECK 1: Initial Canvas State & Authorization Scoping");
    {
      const aliceCanvas = await getCanvasForWorkspace(workspaceId, aliceId);
      assert(aliceCanvas !== null, "Alice (Owner) can read canvas");
      assert(aliceCanvas!.nodes.length === 0, "Initial canvas has 0 nodes");
      assert(aliceCanvas!.version === 0, "Initial canvas version is 0");
      assert(aliceCanvas!.canEdit === true, "Alice canEdit is true");
      assert(aliceCanvas!.currentUserRole === WorkspaceRole.OWNER, "Alice role is OWNER");

      const victorCanvas = await getCanvasForWorkspace(workspaceId, victorId);
      assert(victorCanvas !== null, "Victor (Viewer) can read canvas");
      assert(victorCanvas!.canEdit === false, "Victor canEdit is false (Read-only)");
      assert(victorCanvas!.currentUserRole === WorkspaceRole.VIEWER, "Victor role is VIEWER");

      const eveCanvas = await getCanvasForWorkspace(workspaceId, eveId);
      assert(eveCanvas === null, "Eve (Non-member) cannot access canvas (returns null / 404)");

      pass("Initial canvas loading, role permissions, and access scoping verified.");
    }

    // ----------------------------------------------------
    // CHECK 2: True Database Persistence in PostgreSQL
    // ----------------------------------------------------
    console.log("\nCHECK 2: True Database Persistence in PostgreSQL");
    {
      const initialNodes: CanvasNode[] = [
        {
          id: "sticky_1",
          workspaceId,
          type: "STICKY",
          x: 120,
          y: 80,
          width: 220,
          height: 180,
          zIndex: 10,
          content: "Sprint 9 deliverables roadmap",
          colorId: "amber",
          rotation: -1.5,
          authorName: "Alice Owner",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "rect_2",
          workspaceId,
          type: "RECTANGLE",
          x: 400,
          y: 80,
          width: 200,
          height: 130,
          zIndex: 5,
          content: "PostgreSQL Database Service",
          colorId: "sky",
          strokeColor: "#38bdf8",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "circle_3",
          workspaceId,
          type: "CIRCLE",
          x: 650,
          y: 80,
          width: 160,
          height: 160,
          zIndex: 5,
          content: "Cache Layer",
          colorId: "emerald",
          strokeColor: "#34d399",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "text_4",
          workspaceId,
          type: "TEXT",
          x: 120,
          y: 300,
          width: 260,
          height: 60,
          zIndex: 8,
          content: "Architecture Overview Diagram",
          colorId: "white",
          fontSize: 18,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const saved = await saveCanvasForWorkspace(workspaceId, aliceId, {
        name: "Sprint Architecture Canvas",
        nodes: initialNodes,
        viewport: { x: 50, y: -20, zoom: 1.25 },
      });

      assert(saved.version === 1, "First save sets version to 1");
      assert(saved.nodes.length === 4, "All 4 nodes persisted");
      assert(saved.lastSavedBy?.id === aliceId, "lastSavedBy recorded as Alice");

      // Verify row exists directly in database table
      const dbRow = await prisma.canvas.findUnique({
        where: { workspaceId },
      });

      assert(dbRow !== null, "Canvas row created in 'canvases' table in PostgreSQL");
      assert(dbRow!.version === 1, "Database row has version 1");
      assert(Array.isArray(dbRow!.nodes), "Database row nodes stored as Json array");
      assert((dbRow!.nodes as unknown as CanvasNode[]).length === 4, "4 nodes persisted in database");

      pass("Canvas objects and metadata verified directly in PostgreSQL database.");
    }

    // ----------------------------------------------------
    // CHECK 3: Server-Side Refresh Recovery
    // ----------------------------------------------------
    console.log("\nCHECK 3: Server-Side Refresh Recovery");
    {
      const recovered = await getCanvasForWorkspace(workspaceId, bobId);
      assert(recovered !== null, "Bob retrieved saved canvas");
      assert(recovered!.version === 1, "Recovered canvas has version 1");
      assert(recovered!.nodes.length === 4, "Recovered exact 4 nodes");
      assert(recovered!.nodes[0].content === "Sprint 9 deliverables roadmap", "Node 1 content recovered");
      assert(recovered!.nodes[1].colorId === "sky", "Node 2 styling recovered");
      assert(recovered!.viewport.zoom === 1.25, "Viewport zoom recovered");
      assert(recovered!.viewport.x === 50, "Viewport x recovered");

      pass("Server-side reload recovered full canvas state and styling identical to saved state.");
    }

    // ----------------------------------------------------
    // CHECK 4: Role-Based Access Controls (Read & Write)
    // ----------------------------------------------------
    console.log("\nCHECK 4: Role-Based Authorization Enforcement");
    {
      // Bob (MEMBER) saves an update -> should succeed
      const updatedNodes: CanvasNode[] = [
        {
          id: "sticky_1",
          workspaceId,
          type: "STICKY",
          x: 150,
          y: 90,
          width: 220,
          height: 180,
          zIndex: 10,
          content: "Updated by Bob",
          colorId: "violet",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const bobSaved = await saveCanvasForWorkspace(workspaceId, bobId, {
        nodes: updatedNodes,
        expectedVersion: 1,
      });

      assert(bobSaved.version === 2, "Bob's save succeeded and incremented version to 2");
      assert(bobSaved.lastSavedBy?.id === bobId, "lastSavedBy updated to Bob");

      // Victor (VIEWER) attempts to save -> must fail with 403
      let viewerFailed = false;
      try {
        await saveCanvasForWorkspace(workspaceId, victorId, {
          nodes: updatedNodes,
        });
      } catch (err: unknown) {
        if (err instanceof WorkspaceError && err.status === 403) {
          viewerFailed = true;
        }
      }
      assert(viewerFailed, "Viewer save correctly rejected with 403 Forbidden");

      // Eve (Intruder) attempts to save -> must fail with 403
      let intruderFailed = false;
      try {
        await saveCanvasForWorkspace(workspaceId, eveId, {
          nodes: updatedNodes,
        });
      } catch (err: unknown) {
        if (err instanceof WorkspaceError && err.status === 403) {
          intruderFailed = true;
        }
      }
      assert(intruderFailed, "Non-member save correctly rejected with 403 Forbidden");

      pass("Role boundaries strictly enforced: Member allowed, Viewer & Intruder blocked.");
    }

    // ----------------------------------------------------
    // CHECK 5: Optimistic Concurrency & Stale Save Conflict Detection
    // ----------------------------------------------------
    console.log("\nCHECK 5: Concurrency Protection & Stale Save Conflict (409)");
    {
      // Database version is currently 2
      const staleNodes: CanvasNode[] = [
        {
          id: "sticky_stale",
          workspaceId,
          type: "STICKY",
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          zIndex: 1,
          content: "Stale update from slow tab",
          colorId: "rose",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      let conflictCaught = false;
      try {
        // Alice sends a save with expectedVersion: 1, but server version is 2
        await saveCanvasForWorkspace(workspaceId, aliceId, {
          nodes: staleNodes,
          expectedVersion: 1,
        });
      } catch (err: unknown) {
        if (err instanceof CanvasConflictError && err.status === 409) {
          conflictCaught = true;
          assert(err.currentVersion === 2, "Conflict error reports current version 2");
        }
      }

      assert(conflictCaught, "Stale save with older expectedVersion rejected with 409 Conflict");

      // Verify that database was NOT corrupted by stale save
      const currentDb = await prisma.canvas.findUnique({ where: { workspaceId } });
      assert(currentDb!.version === 2, "Database version remained at 2 without corruption");
      assert(
        (currentDb!.nodes as unknown as CanvasNode[])[0].content === "Updated by Bob",
        "Newer content preserved against stale overwrite"
      );

      pass("Concurrency control rejected stale request (409) and preserved newer database state.");
    }

    // ----------------------------------------------------
    // CHECK 6: Data Validation and Sensible Limits
    // ----------------------------------------------------
    console.log("\nCHECK 6: Data Validation & Limits Enforcement");
    {
      // 1. Max object count limit (> 500 nodes)
      const oversizedNodes: CanvasNode[] = Array.from({ length: MAX_CANVAS_NODES + 1 }).map((_, idx) => ({
        id: `node_${idx}`,
        workspaceId,
        type: "STICKY",
        x: idx * 10,
        y: idx * 10,
        width: 100,
        height: 100,
        zIndex: 1,
        content: `Node ${idx}`,
        colorId: "amber",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      let countLimitCaught = false;
      try {
        await saveCanvasForWorkspace(workspaceId, aliceId, { nodes: oversizedNodes });
      } catch (err: unknown) {
        if (err instanceof WorkspaceError && err.status === 400) {
          countLimitCaught = true;
        }
      }
      assert(countLimitCaught, "Oversized canvas (>500 objects) rejected with 400 Bad Request");

      // 2. Invalid node type
      const invalidTypeNode = [
        {
          id: "bad_node_1",
          workspaceId,
          type: "MALICIOUS_SCRIPT" as unknown as CanvasNodeType,
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          zIndex: 1,
          content: "test",
          colorId: "amber",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      let invalidTypeCaught = false;
      try {
        await saveCanvasForWorkspace(workspaceId, aliceId, { nodes: invalidTypeNode });
      } catch (err: unknown) {
        if (err instanceof WorkspaceError && err.status === 400) {
          invalidTypeCaught = true;
        }
      }
      assert(invalidTypeCaught, "Invalid node type rejected with 400 Bad Request");

      // 3. Node content length limit
      const massiveContentNode = [
        {
          id: "huge_node_1",
          workspaceId,
          type: "STICKY" as CanvasNodeType,
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          zIndex: 1,
          content: "A".repeat(10001), // exceeds 10000 chars limit
          colorId: "amber",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      let massiveContentCaught = false;
      try {
        await saveCanvasForWorkspace(workspaceId, aliceId, { nodes: massiveContentNode });
      } catch (err: unknown) {
        if (err instanceof WorkspaceError && err.status === 400) {
          massiveContentCaught = true;
        }
      }
      assert(massiveContentCaught, "Node exceeding character limit rejected with 400 Bad Request");

      pass("Input validation, schema sanity, and limit boundaries verified.");
    }

    // ----------------------------------------------------
    // CHECK 7: Cascade Deletion
    // ----------------------------------------------------
    console.log("\nCHECK 7: Cascade Deletion Integrity");
    {
      await prisma.workspace.delete({ where: { id: workspaceId } });
      const orphanCanvas = await prisma.canvas.findUnique({ where: { workspaceId } });
      assert(orphanCanvas === null, "Deleting workspace cascades and removes associated canvas");
      pass("Cascade deletion integrity verified.");
    }

    console.log("\n=================================================");
    console.log("ALL PHASE 9A STEP 3 PERSISTENCE CHECKS PASSED!");
    console.log("=================================================\n");
  } finally {
    // Cleanup fixtures
    if (aliceId) await prisma.user.deleteMany({ where: { id: aliceId } }).catch(() => {});
    if (bobId) await prisma.user.deleteMany({ where: { id: bobId } }).catch(() => {});
    if (victorId) await prisma.user.deleteMany({ where: { id: victorId } }).catch(() => {});
    if (eveId) await prisma.user.deleteMany({ where: { id: eveId } }).catch(() => {});
  }
}

runPersistenceTestSuite().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});

