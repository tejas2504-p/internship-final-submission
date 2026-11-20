import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import {
  getUserWorkspaces,
  getWorkspaceForUser,
  getWorkspaceActivities,
  searchWorkspace,
} from "../src/lib/services/workspace";
import { getCanvasForWorkspace } from "../src/lib/services/canvas";

export interface BenchmarkMetrics {
  timestamp: string;
  database: {
    getUserWorkspacesMs: number;
    getWorkspaceForUserMs: number;
    getCanvasMs: number;
    canvasPayloadSizeBytes: number;
    getActivitiesMs: number;
    searchWorkspaceMs: number;
  };
  collaboration: {
    yjsCompactTimeMs: number;
    yjsSnapshotSizeBytes: number;
    awarenessEncode5UsersMs: number;
    awarenessPayload5UsersBytes: number;
    awarenessEncode20UsersMs: number;
    awarenessPayload20UsersBytes: number;
  };
  canvasProcessing: {
    process100NodesMs: number;
    process500NodesMs: number;
  };
}

async function runBenchmark(label: string): Promise<BenchmarkMetrics> {
  console.log(`\n=================================================`);
  console.log(`SyncSpace Phase 11.1 Performance Benchmark: ${label}`);
  console.log(`=================================================`);

  // 1. Find a test user and workspace
  const user = await prisma.user.findFirst({
    include: {
      ownedWorkspaces: {
        include: {
          pages: true,
          canvas: true,
        },
        take: 1,
      },
    },
  });

  if (!user || user.ownedWorkspaces.length === 0) {
    throw new Error("No user with workspace found for benchmark.");
  }

  const workspace = user.ownedWorkspaces[0];
  console.log(`Using Benchmark Workspace: "${workspace.name}" (ID: ${workspace.id}) by User: ${user.name}`);

  // Warmup query
  await getUserWorkspaces(user.id);

  // -------------------------------------------------------------
  // DATABASE BENCHMARKS
  // -------------------------------------------------------------
  const dbRuns = 5;

  // A. getUserWorkspaces
  let totalTime = 0;
  for (let i = 0; i < dbRuns; i++) {
    const t0 = performance.now();
    await getUserWorkspaces(user.id);
    totalTime += performance.now() - t0;
  }
  const getUserWorkspacesMs = Number((totalTime / dbRuns).toFixed(2));

  // B. getWorkspaceForUser
  totalTime = 0;
  for (let i = 0; i < dbRuns; i++) {
    const t0 = performance.now();
    await getWorkspaceForUser(workspace.id, user.id);
    totalTime += performance.now() - t0;
  }
  const getWorkspaceForUserMs = Number((totalTime / dbRuns).toFixed(2));

  // C. getCanvasForWorkspace
  totalTime = 0;
  let canvasResult = null;
  for (let i = 0; i < dbRuns; i++) {
    const t0 = performance.now();
    canvasResult = await getCanvasForWorkspace(workspace.id, user.id);
    totalTime += performance.now() - t0;
  }
  const getCanvasMs = Number((totalTime / dbRuns).toFixed(2));
  const canvasPayloadSizeBytes = Buffer.byteLength(JSON.stringify(canvasResult || {}));

  // D. getWorkspaceActivities
  totalTime = 0;
  for (let i = 0; i < dbRuns; i++) {
    const t0 = performance.now();
    await getWorkspaceActivities(workspace.id, user.id, 50);
    totalTime += performance.now() - t0;
  }
  const getActivitiesMs = Number((totalTime / dbRuns).toFixed(2));

  // E. searchWorkspace
  totalTime = 0;
  for (let i = 0; i < dbRuns; i++) {
    const t0 = performance.now();
    await searchWorkspace(workspace.id, user.id, "test");
    totalTime += performance.now() - t0;
  }
  const searchWorkspaceMs = Number((totalTime / dbRuns).toFixed(2));

  // -------------------------------------------------------------
  // REAL-TIME COLLABORATION BENCHMARKS
  // -------------------------------------------------------------
  // Yjs doc compaction benchmark
  const testDoc = new Y.Doc();
  const yNodes = testDoc.getMap("nodes");
  for (let i = 0; i < 200; i++) {
    yNodes.set(`node-${i}`, {
      id: `node-${i}`,
      type: "STICKY",
      x: i * 20,
      y: i * 15,
      width: 200,
      height: 180,
      content: `Simulated collaborative sticky note content ${i} with revisions and details.`,
      colorId: "amber",
      zIndex: i,
    });
  }

  const tCompact0 = performance.now();
  const compactedSnapshot = Y.encodeStateAsUpdate(testDoc);
  const yjsCompactTimeMs = Number((performance.now() - tCompact0).toFixed(2));
  const yjsSnapshotSizeBytes = compactedSnapshot.byteLength;

  // Awareness encoding benchmark
  const awarenessList5 = Array.from({ length: 5 }, () => new awarenessProtocol.Awareness(testDoc));
  awarenessList5.forEach((aw, u) => {
    aw.setLocalState({
      user: { id: `user-${u}`, name: `Collaborator ${u}`, color: "#4f46e5" },
      cursor: { x: 100 * (u + 1), y: 150 * (u + 1) },
      selectedNodeId: `node-${u}`,
    });
  });

  const tAwareness5_0 = performance.now();
  const encodedUpdates5 = awarenessList5.map((aw) =>
    awarenessProtocol.encodeAwarenessUpdate(aw, [aw.clientID])
  );
  const awarenessEncode5UsersMs = Number((performance.now() - tAwareness5_0).toFixed(3));
  const awarenessPayload5UsersBytes = encodedUpdates5.reduce((acc, u) => acc + u.byteLength, 0);

  // 20 users awareness
  const awarenessList20 = Array.from({ length: 20 }, () => new awarenessProtocol.Awareness(testDoc));
  awarenessList20.forEach((aw, u) => {
    aw.setLocalState({
      user: { id: `user-${u}`, name: `Collaborator ${u}`, color: "#4f46e5" },
      cursor: { x: 50 * (u + 1), y: 75 * (u + 1) },
      selectedNodeId: `node-${u}`,
    });
  });

  const tAwareness20_0 = performance.now();
  const encodedUpdates20 = awarenessList20.map((aw) =>
    awarenessProtocol.encodeAwarenessUpdate(aw, [aw.clientID])
  );
  const awarenessEncode20UsersMs = Number((performance.now() - tAwareness20_0).toFixed(3));
  const awarenessPayload20UsersBytes = encodedUpdates20.reduce((acc, u) => acc + u.byteLength, 0);

  // -------------------------------------------------------------
  // CANVAS RENDERING / PROCESSING BENCHMARK
  // -------------------------------------------------------------
  const nodes100 = Array.from({ length: 100 }, (_, i) => ({
    id: `node-${i}`,
    type: "STICKY",
    x: (i % 10) * 220,
    y: Math.floor(i / 10) * 200,
    width: 200,
    height: 180,
    content: `Sticky node ${i}`,
    colorId: "amber",
    zIndex: i,
  }));

  const tProc100_0 = performance.now();
  // Simulate view transformation and bounding box calculation
  for (let step = 0; step < 50; step++) {
    const zoom = 1.0 + (step % 5) * 0.1;
    const panX = step * 10;
    const panY = step * 8;
    nodes100.map((n) => ({
      ...n,
      screenX: n.x * zoom + panX,
      screenY: n.y * zoom + panY,
      screenWidth: n.width * zoom,
      screenHeight: n.height * zoom,
    }));
  }
  const process100NodesMs = Number(((performance.now() - tProc100_0) / 50).toFixed(2));

  const nodes500 = Array.from({ length: 500 }, (_, i) => ({
    id: `node-${i}`,
    type: "STICKY",
    x: (i % 25) * 220,
    y: Math.floor(i / 25) * 200,
    width: 200,
    height: 180,
    content: `Sticky node ${i}`,
    colorId: "amber",
    zIndex: i,
  }));

  const tProc500_0 = performance.now();
  for (let step = 0; step < 50; step++) {
    const zoom = 1.0 + (step % 5) * 0.1;
    const panX = step * 10;
    const panY = step * 8;
    nodes500.map((n) => ({
      ...n,
      screenX: n.x * zoom + panX,
      screenY: n.y * zoom + panY,
      screenWidth: n.width * zoom,
      screenHeight: n.height * zoom,
    }));
  }
  const process500NodesMs = Number(((performance.now() - tProc500_0) / 50).toFixed(2));

  const metrics: BenchmarkMetrics = {
    timestamp: new Date().toISOString(),
    database: {
      getUserWorkspacesMs,
      getWorkspaceForUserMs,
      getCanvasMs,
      canvasPayloadSizeBytes,
      getActivitiesMs,
      searchWorkspaceMs,
    },
    collaboration: {
      yjsCompactTimeMs,
      yjsSnapshotSizeBytes,
      awarenessEncode5UsersMs,
      awarenessPayload5UsersBytes,
      awarenessEncode20UsersMs,
      awarenessPayload20UsersBytes,
    },
    canvasProcessing: {
      process100NodesMs,
      process500NodesMs,
    },
  };

  console.log(`\nResults:`, JSON.stringify(metrics, null, 2));
  return metrics;
}

runBenchmark(process.argv[2] || "BASELINE")
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
  });
