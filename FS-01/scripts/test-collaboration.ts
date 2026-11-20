import "dotenv/config";
import http from "http";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { prisma } from "../src/lib/db/prisma";
import {
  createWorkspace,
  addWorkspaceMember,
  createPage,
  deleteWorkspace,
} from "../src/lib/services/workspace";
import { signCollabToken } from "../src/lib/collaboration/token";
import { WorkspaceRole } from "@prisma/client";

const COLLAB_PORT = parseInt(process.env.COLLAB_PORT || "1234", 10);
const WS_BASE_URL = `ws://localhost:${COLLAB_PORT}`;
const HTTP_BASE_URL = `http://localhost:${COLLAB_PORT}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkHealth(): Promise<any> {
  return new Promise((resolve, reject) => {
    http
      .get(`${HTTP_BASE_URL}/health`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ raw: body, statusCode: res.statusCode });
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Helper to test raw WebSocket connection and closure codes.
 */
function testRawWsConnection(
  urlPath: string
): Promise<{ opened: boolean; closeCode: number; closeReason: string }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_BASE_URL}${urlPath}`);
    let opened = false;

    ws.on("open", () => {
      opened = true;
    });

    ws.on("close", (code, reason) => {
      resolve({
        opened,
        closeCode: code,
        closeReason: reason.toString(),
      });
    });

    ws.on("error", () => {
      // errors will trigger 'close' event
    });

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Test timeout");
        resolve({ opened: true, closeCode: 1000, closeReason: "Timeout closed" });
      }
    }, 4000);
  });
}

function waitForSync(provider: WebsocketProvider, timeoutMs = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.synced) {
      return resolve();
    }
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for provider sync after ${timeoutMs}ms (connected: ${provider.wsconnected})`
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

async function runCollaborationTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 5A: Real-Time Collaboration Test Suite");
  console.log("=================================================\n");

  const ts = Date.now();
  const aliceEmail = `collab-alice-${ts}@test.syncspace.dev`;
  const bobEmail = `collab-bob-${ts}@test.syncspace.dev`;
  const danaEmail = `collab-dana-${ts}@test.syncspace.dev`;
  const charlieEmail = `collab-charlie-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let danaId = "";
  let charlieId = "";
  let workspaceId = "";
  let pageId = "";
  let page2Id = "";

  const providersToCleanup: WebsocketProvider[] = [];
  const docsToCleanup: Y.Doc[] = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Verify collaboration server is reachable and healthy
    // -------------------------------------------------------------
    console.log("TEST 1: Collaboration Server HTTP /health Check");
    const health = await checkHealth();
    console.log("  Health response:", JSON.stringify(health));
    if (health.status !== "ok" || health.service !== "SyncSpace Collaboration Server") {
      throw new Error(`Collaboration server health check failed: ${JSON.stringify(health)}`);
    }
    console.log("  [PASS] Server is active and healthy.\n");

    // -------------------------------------------------------------
    // Test Setup: Seed users, workspace, and pages in PostgreSQL
    // -------------------------------------------------------------
    console.log("[Setup] Creating test users and workspace...");
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
      data: { name: "Charlie NonMember", email: charlieEmail, emailVerified: true },
    });
    charlieId = charlie.id;

    const workspace = await createWorkspace(aliceId, { name: "Realtime Collab Lab" });
    workspaceId = workspace.id;

    await addWorkspaceMember(workspaceId, aliceId, bobEmail, WorkspaceRole.MEMBER);
    await addWorkspaceMember(workspaceId, aliceId, danaEmail, WorkspaceRole.VIEWER);

    // Initial structured content for page
    const initialContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Collaborative Architecture Document" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Initial seeded paragraph from database." }],
        },
      ],
    };

    const page = await createPage(workspaceId, aliceId, {
      title: "Collaborative Architecture Document",
      content: JSON.stringify(initialContent),
    });
    pageId = page.id;

    const page2 = await createPage(workspaceId, aliceId, {
      title: "Isolated Second Page",
      content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    });
    page2Id = page2.id;

    console.log(`  Created workspace=${workspaceId}, page=${pageId}, page2=${page2Id}\n`);

    const roomName = `${workspaceId}:${pageId}`;

    // -------------------------------------------------------------
    // Test 2: Connection Security & Token Authentication
    // -------------------------------------------------------------
    console.log("TEST 2: Authentication & Authorization Security Enforcements");

    // 2a. No token
    console.log("  2a: Connection with missing token...");
    const noTokenRes = await testRawWsConnection(`/${roomName}`);
    console.log(`      Close code: ${noTokenRes.closeCode}, Reason: ${noTokenRes.closeReason}`);
    if (noTokenRes.closeCode !== 4401) {
      throw new Error(`Expected 4401 close code for missing token, got ${noTokenRes.closeCode}`);
    }
    console.log("      [PASS] Missing token rejected with 4401.");

    // 2b. Forged / invalid signature token
    console.log("  2b: Connection with forged token...");
    const forgedToken = "eyJhbGciOiJIUzI1NiJ9.invalidpayload.invalidsignature";
    const forgedRes = await testRawWsConnection(`/${roomName}?token=${forgedToken}`);
    console.log(`      Close code: ${forgedRes.closeCode}, Reason: ${forgedRes.closeReason}`);
    if (forgedRes.closeCode !== 4401) {
      throw new Error(`Expected 4401 for forged token, got ${forgedRes.closeCode}`);
    }
    console.log("      [PASS] Forged token rejected with 4401.");

    // 2c. Expired token
    console.log("  2c: Connection with expired token (-10 seconds)...");
    const expiredToken = signCollabToken(
      {
        userId: aliceId,
        userName: "Alice Owner",
        workspaceId,
        pageId,
        canEdit: true,
        role: "OWNER",
      },
      -10
    );
    const expiredRes = await testRawWsConnection(`/${roomName}?token=${expiredToken}`);
    console.log(`      Close code: ${expiredRes.closeCode}, Reason: ${expiredRes.closeReason}`);
    if (expiredRes.closeCode !== 4401) {
      throw new Error(`Expected 4401 for expired token, got ${expiredRes.closeCode}`);
    }
    console.log("      [PASS] Expired token rejected with 4401.");

    // 2d. Scope mismatch (Token issued for page2, connecting to page1 room)
    console.log("  2d: Connection with mismatched room scope...");
    const mismatchToken = signCollabToken({
      userId: aliceId,
      userName: "Alice Owner",
      workspaceId,
      pageId: page2Id, // Token for page 2
      canEdit: true,
      role: "OWNER",
    });
    const mismatchRes = await testRawWsConnection(`/${roomName}?token=${mismatchToken}`);
    console.log(`      Close code: ${mismatchRes.closeCode}, Reason: ${mismatchRes.closeReason}`);
    if (mismatchRes.closeCode !== 4403) {
      throw new Error(`Expected 4403 for scope mismatch, got ${mismatchRes.closeCode}`);
    }
    console.log("      [PASS] Room scope mismatch rejected with 4403.");

    // 2e. Non-member user attempting to connect
    console.log("  2e: Connection by user who is not a member of workspace...");
    const nonMemberToken = signCollabToken({
      userId: charlieId,
      userName: "Charlie NonMember",
      workspaceId,
      pageId,
      canEdit: true,
      role: "MEMBER",
    });
    const nonMemberRes = await testRawWsConnection(`/${roomName}?token=${nonMemberToken}`);
    console.log(`      Close code: ${nonMemberRes.closeCode}, Reason: ${nonMemberRes.closeReason}`);
    if (nonMemberRes.closeCode !== 4403) {
      throw new Error(`Expected 4403 for non-member, got ${nonMemberRes.closeCode}`);
    }
    console.log("      [PASS] Non-member access rejected with 4403.\n");

    // -------------------------------------------------------------
    // Test 3: Two Authenticated Peers Connecting & Bi-directional Sync
    // -------------------------------------------------------------
    console.log("TEST 3: Two Authenticated Peers (Alice & Bob) Real-Time Sync");

    const aliceToken = signCollabToken({
      userId: aliceId,
      userName: "Alice Owner",
      workspaceId,
      pageId,
      canEdit: true,
      role: "OWNER",
    });

    const bobToken = signCollabToken({
      userId: bobId,
      userName: "Bob Editor",
      workspaceId,
      pageId,
      canEdit: true,
      role: "MEMBER",
    });

    const aliceDoc = new Y.Doc();
    const bobDoc = new Y.Doc();
    docsToCleanup.push(aliceDoc, bobDoc);

    const aliceProvider = new WebsocketProvider(WS_BASE_URL, roomName, aliceDoc, {
      params: { token: aliceToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(aliceProvider);

    const bobProvider = new WebsocketProvider(WS_BASE_URL, roomName, bobDoc, {
      params: { token: bobToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(bobProvider);

    // Wait for both to connect and complete sync
    console.log("  Waiting for Alice and Bob to connect and synchronize initial state...");
    await Promise.all([waitForSync(aliceProvider), waitForSync(bobProvider)]);

    const aliceXml = aliceDoc.getXmlFragment("default");
    const bobXml = bobDoc.getXmlFragment("default");

    console.log(`  Initial Alice XML children: ${aliceXml.length}`);
    console.log(`  Initial Bob XML children:   ${bobXml.length}`);

    // Verify initial state seeded from PostgreSQL exists in both clients
    if (aliceXml.length === 0 || bobXml.length === 0) {
      throw new Error("Y.Doc was not seeded from PostgreSQL into clients!");
    }
    console.log("  [PASS] Initial state seeded from PostgreSQL into both peers.");

    // Alice types in a shared text structure
    console.log("  Alice inserting live edit into shared Yjs text...");
    const aliceText = aliceDoc.getText("live_collaboration_text");
    aliceText.insert(0, "Live collaborative edits from Alice");

    // Allow sync propagation (locally usually < 50ms)
    await sleep(200);

    const bobText = bobDoc.getText("live_collaboration_text");
    console.log(`  Bob received text: "${bobText.toString()}"`);
    if (bobText.toString() !== "Live collaborative edits from Alice") {
      throw new Error(`Sync failure: Bob expected Alice's text, got: "${bobText.toString()}"`);
    }
    console.log("  [PASS] Alice's edit propagated to Bob in real time without refreshing.\n");

    // -------------------------------------------------------------
    // Test 4: Concurrent Edits to the Same Paragraph & CRDT Convergence
    // -------------------------------------------------------------
    console.log("TEST 4: Concurrent Edits to Same Text & CRDT Convergence");
    // Both Alice and Bob concurrently type into the same shared text
    aliceText.insert(0, "[ALICE-START] ");
    bobText.insert(bobText.length, " [BOB-END]");

    await sleep(200);

    console.log(`  Alice converged state: "${aliceText.toString()}"`);
    console.log(`  Bob converged state:   "${bobText.toString()}"`);

    if (aliceText.toString() !== bobText.toString()) {
      throw new Error(
        `CRDT divergence! Alice="${aliceText.toString()}" vs Bob="${bobText.toString()}"`
      );
    }
    if (
      !aliceText.toString().startsWith("[ALICE-START]") ||
      !aliceText.toString().endsWith("[BOB-END]")
    ) {
      throw new Error(`Missing concurrent modifications in converged text: ${aliceText.toString()}`);
    }
    console.log("  [PASS] Concurrent edits converged identically on both clients.\n");

    // -------------------------------------------------------------
    // Test 5: Read-Only Viewer Enforcement (Write Immunity)
    // -------------------------------------------------------------
    console.log("TEST 5: Viewer Write Immunity & Read Access");

    const danaToken = signCollabToken({
      userId: danaId,
      userName: "Dana Viewer",
      workspaceId,
      pageId,
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

    // Verify Dana has read access and received the synchronized state
    const danaText = danaDoc.getText("live_collaboration_text");
    console.log(`  Dana (Viewer) received doc state: "${danaText.toString()}"`);
    if (danaText.toString() !== aliceText.toString()) {
      throw new Error(
        `Viewer read failure: Dana got "${danaText.toString()}" expected "${aliceText.toString()}"`
      );
    }
    console.log("  [PASS] Viewer successfully received document state.");

    // Dana attempts to write / mutate the document
    console.log("  Dana attempting unauthorized write...");
    const stateBeforeDanaAttempt = aliceText.toString();
    danaText.insert(0, "[HACKED BY VIEWER] ");

    // Wait for server to process and reject update
    await sleep(300);

    // Verify that neither Alice nor Bob received Dana's write
    console.log(`  Alice text after Dana write attempt: "${aliceText.toString()}"`);
    console.log(`  Bob text after Dana write attempt:   "${bobText.toString()}"`);

    if (aliceText.toString() !== stateBeforeDanaAttempt) {
      throw new Error("SECURITY BREACH: Viewer was able to modify document content on peers!");
    }
    if (bobText.toString() !== stateBeforeDanaAttempt) {
      throw new Error("SECURITY BREACH: Viewer write propagated to Bob!");
    }
    console.log("  [PASS] Server successfully dropped viewer's unauthorized write.\n");

    // -------------------------------------------------------------
    // Test 6: Room Isolation & Cross-Workspace Data Leakage Protection
    // -------------------------------------------------------------
    console.log("TEST 6: Room Isolation Between Distinct Pages");

    const page2RoomName = `${workspaceId}:${page2Id}`;
    const page2Token = signCollabToken({
      userId: aliceId,
      userName: "Alice Owner",
      workspaceId,
      pageId: page2Id,
      canEdit: true,
      role: "OWNER",
    });

    const page2Doc = new Y.Doc();
    docsToCleanup.push(page2Doc);

    const page2Provider = new WebsocketProvider(WS_BASE_URL, page2RoomName, page2Doc, {
      params: { token: page2Token },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(page2Provider);

    await waitForSync(page2Provider);

    const page2Text = page2Doc.getText("live_collaboration_text");
    page2Text.insert(0, "Confidential page 2 text");

    await sleep(200);

    // Verify Page 2 text did not bleed into Page 1 (Alice/Bob)
    if (aliceText.toString().includes("Confidential page 2 text")) {
      throw new Error("Data leakage! Page 2 update bled into Page 1!");
    }
    // Verify Page 1 text did not bleed into Page 2
    if (page2Text.toString().includes("[ALICE-START]")) {
      throw new Error("Data leakage! Page 1 update bled into Page 2!");
    }
    console.log("  [PASS] Complete isolation between rooms; zero cross-room data leakage.\n");

    console.log("=================================================");
    console.log("ALL COLLABORATION TESTS PASSED (6/6)! 100% SUCCESS");
    console.log("=================================================");
  } finally {
    // Cleanup providers and docs
    for (const provider of providersToCleanup) {
      provider.destroy();
    }
    for (const doc of docsToCleanup) {
      doc.destroy();
    }

    // Cleanup DB fixtures
    if (workspaceId) {
      console.log("\n[Cleanup] Cleaning up test workspace and users...");
      await sleep(1500);
      try {
        await deleteWorkspace(workspaceId, aliceId);
      } catch (e) {
        // Retry once after 1s
        await sleep(1000);
        await deleteWorkspace(workspaceId, aliceId).catch(() => {});
      }
    }
    if (aliceId || bobId || danaId || charlieId) {
      await prisma.user.deleteMany({
        where: {
          id: { in: [aliceId, bobId, danaId, charlieId].filter(Boolean) },
        },
      });
      console.log("[Cleanup] Database fixtures deleted.");
    }
    await prisma.$disconnect();
  }
}

runCollaborationTests().catch((err) => {
  console.error("\nTEST SUITE FAILED WITH ERROR:");
  console.error(err);
  process.exit(1);
});
