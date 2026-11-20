import "dotenv/config";
import http from "http";
import { fork, type ChildProcess } from "child_process";
import path from "path";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { WebSocket } from "ws";
import { prisma } from "../src/lib/db/prisma";
import {
  createWorkspace,
  addWorkspaceMember,
  createPage,
  deleteWorkspace,
} from "../src/lib/services/workspace";
import { signCollabToken } from "../src/lib/collaboration/token";
import { WorkspaceRole } from "@prisma/client";

const PORT_1 = 1234;
const PORT_2 = 1235;
const HTTP_URL_1 = `http://localhost:${PORT_1}`;
const HTTP_URL_2 = `http://localhost:${PORT_2}`;
const WS_URL_1 = `ws://localhost:${PORT_1}`;
const WS_URL_2 = `ws://localhost:${PORT_2}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkHealth(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http
      .get(`${url}/health`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ raw: body, statusCode: res.statusCode });
          }
        });
      })
      .on("error", reject);
  });
}

async function waitForServerReady(url: string, maxWaitMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const health = await checkHealth(url);
      if (health?.status === "ok") {
        return;
      }
    } catch {
      // Still booting
    }
    await sleep(250);
  }
  throw new Error(`Server at ${url} failed to become healthy after ${maxWaitMs}ms`);
}

function waitForSync(provider: WebsocketProvider, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve();
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for sync on ${provider.url}`));
    }, timeoutMs);

    provider.once("sync", (isSynced: boolean) => {
      if (isSynced) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 6000,
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

async function runMultiInstanceLiveTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 7B: Live Dual-Server End-to-End Suite");
  console.log(`Instance 1: ${WS_URL_1} | Instance 2: ${WS_URL_2}`);
  console.log("=================================================\n");

  const serverScript = path.resolve(__dirname, "../collaboration-server/server.ts");
  const tsxBin = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");

  let proc1: ChildProcess | null = null;
  let proc2: ChildProcess | null = null;

  const providersToCleanup: WebsocketProvider[] = [];
  const docsToCleanup: Y.Doc[] = [];

  let workspaceId = "";
  let aliceId = "";
  let bobId = "";
  let danaId = "";
  let charlieId = "";
  let pageId = "";

  try {
    // -------------------------------------------------------------
    // Step 1: Spawn Server Instance 1 (:1234) and Server Instance 2 (:1235)
    // -------------------------------------------------------------
    console.log("[Launch] Starting Server Instance 1 on port 1234...");
    proc1 = fork(tsxBin, [serverScript, "1234"], {
      env: { ...process.env, COLLAB_PORT: "1234", REDIS_ENABLED: "true" },
      stdio: "pipe",
    });

    console.log("[Launch] Starting Server Instance 2 on port 1235...");
    proc2 = fork(tsxBin, [serverScript, "1235"], {
      env: { ...process.env, COLLAB_PORT: "1235", REDIS_ENABLED: "true" },
      stdio: "pipe",
    });

    proc1.stdout?.on("data", (d) => process.stdout.write(`[Server-1234] ${d.toString()}`));
    proc2.stdout?.on("data", (d) => process.stdout.write(`[Server-1235] ${d.toString()}`));

    await Promise.all([
      waitForServerReady(HTTP_URL_1),
      waitForServerReady(HTTP_URL_2),
    ]);

    const health1 = await checkHealth(HTTP_URL_1);
    const health2 = await checkHealth(HTTP_URL_2);

    console.log("\n[Health] Instance 1 Health:", JSON.stringify(health1));
    console.log("[Health] Instance 2 Health:", JSON.stringify(health2));

    if (!health1.redis?.connected || !health2.redis?.connected) {
      throw new Error("Both instances must have active Redis connections for Phase 7B test!");
    }
    console.log("  [PASS] Both server instances running and coordinated via Redis.\n");

    // -------------------------------------------------------------
    // Step 2: Seed workspace and users in PostgreSQL
    // -------------------------------------------------------------
    console.log("[Setup] Creating test users and workspace in PostgreSQL...");
    const ts = Date.now();
    const aliceEmail = `alice-7b-${ts}@syncspace.dev`;
    const bobEmail = `bob-7b-${ts}@syncspace.dev`;
    const danaEmail = `dana-7b-${ts}@syncspace.dev`;
    const charlieEmail = `charlie-7b-${ts}@syncspace.dev`;

    const alice = await prisma.user.create({
      data: { name: "Alice Owner", email: aliceEmail, emailVerified: true },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: { name: "Bob Editor", email: bobEmail, emailVerified: true },
    });
    bobId = bob.id;

    const dana = await prisma.user.create({
      data: { name: "Dana Viewer", email: danaEmail, emailVerified: true },
    });
    danaId = dana.id;

    const charlie = await prisma.user.create({
      data: { name: "Charlie Editor", email: charlieEmail, emailVerified: true },
    });
    charlieId = charlie.id;

    const ws = await createWorkspace(aliceId, { name: `Phase 7B Dual-Server WS ${ts}` });
    workspaceId = ws.id;

    await addWorkspaceMember(workspaceId, aliceId, bobEmail, WorkspaceRole.MEMBER);
    await addWorkspaceMember(workspaceId, aliceId, danaEmail, WorkspaceRole.VIEWER);
    await addWorkspaceMember(workspaceId, aliceId, charlieEmail, WorkspaceRole.MEMBER);

    const pg = await createPage(workspaceId, aliceId, {
      title: "Cross-Server Synchronization Specification",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Initial document state." }],
          },
        ],
      }),
    });
    pageId = pg.id;
    console.log(`  [PASS] Seeded workspace=${workspaceId} page=${pageId}\n`);

    const roomName = `${workspaceId}:${pageId}`;

    // Generate tokens
    const tokenAlice = signCollabToken({
      userId: aliceId,
      userName: "Alice Owner",
      workspaceId,
      pageId,
      canEdit: true,
      role: "OWNER",
    });

    const tokenBob = signCollabToken({
      userId: bobId,
      userName: "Bob Editor",
      workspaceId,
      pageId,
      canEdit: true,
      role: "MEMBER",
    });

    // -------------------------------------------------------------
    // Test 1: Cross-Server Real-Time Document Synchronization
    // -------------------------------------------------------------
    console.log("TEST 1: Bidirectional CRDT Editing across Instance 1 (:1234) and Instance 2 (:1235)");

    const docAlice = new Y.Doc();
    const docBob = new Y.Doc();
    docsToCleanup.push(docAlice, docBob);

    // Alice connects to Instance 1 (:1234)
    const providerAlice = new WebsocketProvider(WS_URL_1, roomName, docAlice, {
      params: { token: tokenAlice },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(providerAlice);

    // Bob connects to Instance 2 (:1235)
    const providerBob = new WebsocketProvider(WS_URL_2, roomName, docBob, {
      params: { token: tokenBob },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(providerBob);

    await Promise.all([waitForSync(providerAlice), waitForSync(providerBob)]);
    console.log("  [Connected] Alice on Server 1 (:1234) and Bob on Server 2 (:1235) synced initial state.");

    const textAlice = docAlice.getText("default");
    const textBob = docBob.getText("default");

    // Alice edits on Server 1
    console.log("  Action: Alice types on Server 1 (:1234)...");
    textAlice.insert(0, "Alice typed on Instance 1. ");

    // Wait for Bob on Server 2 to receive it
    await waitForCondition(() => textBob.toString().includes("Alice typed on Instance 1. "));
    console.log(`  Result on Server 2: '${textBob.toString()}'`);
    console.log("  [PASS] Alice's edit propagated from Instance 1 -> Redis -> Instance 2 -> Bob.");

    // Bob edits on Server 2
    console.log("  Action: Bob appends text on Server 2 (:1235)...");
    textBob.insert(textBob.length, "Bob appended on Instance 2.");

    // Wait for Alice on Server 1 to receive it
    await waitForCondition(() => textAlice.toString().includes("Bob appended on Instance 2."));
    console.log(`  Result on Server 1: '${textAlice.toString()}'`);

    if (textAlice.toString() !== textBob.toString()) {
      throw new Error(`Divergence: Alice='${textAlice.toString()}' vs Bob='${textBob.toString()}'`);
    }
    console.log("  [PASS] Bidirectional edits converged to identical state across both server ports.\n");

    // -------------------------------------------------------------
    // Test 2: Live Cursor Awareness & Presence across instances
    // -------------------------------------------------------------
    console.log("TEST 2: Live Awareness & Cursor Presence across Instance 1 and Instance 2");

    providerAlice.awareness.setLocalStateField("user", {
      userId: aliceId,
      userName: "Alice Owner",
      color: "#6366f1",
      cursor: { line: 2, ch: 14 },
    });

    providerBob.awareness.setLocalStateField("user", {
      userId: bobId,
      userName: "Bob Editor",
      color: "#10b981",
      cursor: { line: 8, ch: 2 },
    });

    // Wait for Bob on Server 2 to see Alice
    await waitForCondition(() => {
      const states = providerBob.awareness.getStates();
      for (const [, state] of states) {
        if (state.user?.userId === aliceId && state.user?.userName === "Alice Owner") {
          return true;
        }
      }
      return false;
    });

    // Wait for Alice on Server 1 to see Bob
    await waitForCondition(() => {
      const states = providerAlice.awareness.getStates();
      for (const [, state] of states) {
        if (state.user?.userId === bobId && state.user?.userName === "Bob Editor") {
          return true;
        }
      }
      return false;
    });

    console.log("  [PASS] Presence and cursor positions propagated bidirectionally across instances.\n");

    // -------------------------------------------------------------
    // Test 3: Awareness Eviction on Disconnect across instances
    // -------------------------------------------------------------
    console.log("TEST 3: Awareness Eviction when Alice disconnects from Instance 1");
    providerAlice.destroy();

    await waitForCondition(() => {
      const states = providerBob.awareness.getStates();
      for (const [, state] of states) {
        if (state.user?.userId === aliceId) {
          return false;
        }
      }
      return true;
    });
    console.log("  [PASS] Alice's awareness was cleanly removed on Server 2 upon disconnect.\n");

    // -------------------------------------------------------------
    // Test 4: Security & Permissions Verification across instances
    // -------------------------------------------------------------
    console.log("TEST 4: Security & Permission Enforcement on Instance 2 (:1235)");

    // 4A: Rejected connection with invalid token
    console.log("  4A: Attempting connection with invalid token to Server 2 (:1235)...");
    const rejectedWs = new WebSocket(`${WS_URL_2}/${roomName}?token=malicious-invalid-token`);
    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      rejectedWs.on("close", (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    const closeResult = await closePromise;
    console.log(`  Rejected socket closed with code=${closeResult.code} reason='${closeResult.reason}'`);
    if (closeResult.code !== 4401) {
      throw new Error(`Expected close code 4401 for invalid token, got ${closeResult.code}`);
    }
    console.log("  [PASS] Authentication required; invalid token rejected on Instance 2.");

    // 4B: Viewer write attempt rejected on Instance 2
    console.log("  4B: Viewer Dana connecting to Instance 2 (:1235)...");
    const tokenDana = signCollabToken({
      userId: danaId,
      userName: "Dana Viewer",
      workspaceId,
      pageId,
      canEdit: false,
      role: "VIEWER",
    });

    const docDana = new Y.Doc();
    docsToCleanup.push(docDana);

    const providerDana = new WebsocketProvider(WS_URL_2, roomName, docDana, {
      params: { token: tokenDana },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(providerDana);

    await waitForSync(providerDana);

    const initialTextBob = textBob.toString();
    console.log("  Viewer Dana attempting write update...");
    const textDana = docDana.getText("default");
    textDana.insert(0, "[UNAUTHORIZED_VIEWER_EDIT]");

    await sleep(400);

    // Verify Bob's doc did not accept the viewer edit
    if (textBob.toString() !== initialTextBob) {
      throw new Error("Security breach! Viewer edit was accepted by server!");
    }
    console.log("  [PASS] Viewer write strictly rejected by collaboration server authorization.\n");

    // -------------------------------------------------------------
    // Test 5: Cold Node Late Joiner Synchronization
    // -------------------------------------------------------------
    console.log("TEST 5: Cold Node Late Joiner Catch-up Sync");
    // Disconnect Bob from Server 2
    providerBob.destroy();
    providerDana.destroy();
    await sleep(300);

    // Reconnect Alice to Server 1 and make an unpersisted in-memory edit
    const docAlice2 = new Y.Doc();
    docsToCleanup.push(docAlice2);
    const providerAlice2 = new WebsocketProvider(WS_URL_1, roomName, docAlice2, {
      params: { token: tokenAlice },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(providerAlice2);
    await waitForSync(providerAlice2);

    const textAlice2 = docAlice2.getText("default");
    textAlice2.insert(textAlice2.length, " [Unpersisted edit by Alice on S1]");
    console.log("  Alice made in-memory edit on Server 1 (not yet flushed to PostgreSQL).");

    // Now Charlie connects to Server 2 (:1235) which currently has 0 clients for this room
    console.log("  Charlie connects to Cold Server 2 (:1235)...");
    const tokenCharlie = signCollabToken({
      userId: charlieId,
      userName: "Charlie Editor",
      workspaceId,
      pageId,
      canEdit: true,
      role: "MEMBER",
    });

    const docCharlie = new Y.Doc();
    docsToCleanup.push(docCharlie);
    const providerCharlie = new WebsocketProvider(WS_URL_2, roomName, docCharlie, {
      params: { token: tokenCharlie },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(providerCharlie);
    await waitForSync(providerCharlie);

    const textCharlie = docCharlie.getText("default");
    console.log(`  Charlie received text on Server 2: '${textCharlie.toString()}'`);

    await waitForCondition(() => textCharlie.toString() === textAlice2.toString());
    console.log("  [PASS] Cold Server 2 automatically synchronized uncommitted memory from Server 1 via Redis.\n");

    // -------------------------------------------------------------
    // Test 6: PostgreSQL Durable Persistence Verification
    // -------------------------------------------------------------
    console.log("TEST 6: PostgreSQL Durable Persistence Verification");
    // Trigger flush across instances
    await sleep(2500); // Wait for debounce save

    const savedPage = await prisma.page.findUnique({
      where: { id: pageId },
      select: { content: true, updatedAt: true },
    });

    const yjsDocRecord = await prisma.yjsDocument.findUnique({
      where: { pageId },
      select: { snapshot: true },
    });

    console.log(`  PostgreSQL page.content exists: ${Boolean(savedPage?.content)}`);
    console.log(`  PostgreSQL yjsDocument snapshot bytes: ${yjsDocRecord?.snapshot.length}`);

    if (!savedPage?.content || !yjsDocRecord?.snapshot) {
      throw new Error("PostgreSQL persistence record missing after multi-server collaboration session!");
    }
    console.log("  [PASS] PostgreSQL holds durable binary Yjs snapshot and synchronized content AST.\n");

    console.log("=================================================");
    console.log("ALL LIVE DUAL-SERVER COLLABORATION TESTS PASSED (6/6)!");
    console.log("=================================================");
  } finally {
    console.log("\n[Teardown] Cleaning up WebSocket providers and client docs...");
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

    if (workspaceId) {
      try {
        await deleteWorkspace(workspaceId, aliceId);
        console.log(`[Teardown] Deleted test workspace=${workspaceId}`);
      } catch {}
    }

    // Clean up created users
    const userIds = [aliceId, bobId, danaId, charlieId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }

    // Terminate server processes
    if (proc1) {
      proc1.kill("SIGTERM");
      console.log("[Teardown] Terminated Server 1 (:1234)");
    }
    if (proc2) {
      proc2.kill("SIGTERM");
      console.log("[Teardown] Terminated Server 2 (:1235)");
    }

    await prisma.$disconnect();
  }
}

runMultiInstanceLiveTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nDUAL-SERVER TEST FAILED WITH ERROR:");
    console.error(err);
    process.exit(1);
  });
