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

// Register WebSocket polyfill for y-websocket under Node.js runtime
(global as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

const COLLAB_PORT = parseInt(process.env.COLLAB_PORT || "1234", 10);
const WS_BASE_URL = `ws://127.0.0.1:${COLLAB_PORT}`;
const HTTP_BASE_URL = `http://127.0.0.1:${COLLAB_PORT}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkHealth(): Promise<{ status: string; version: string; activeRooms: number; dirtyRooms: number }> {
  return new Promise((resolve, reject) => {
    http
      .get(`${HTTP_BASE_URL}/health`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Invalid JSON from /health: ${body}`));
          }
        });
      })
      .on("error", reject);
  });
}

function waitForSync(provider: WebsocketProvider, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve();
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for Yjs sync"));
    }, timeoutMs);

    provider.once("sync", (isSynced: boolean) => {
      if (isSynced) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

function waitForAwarenessCount(provider: WebsocketProvider, expectedCount: number, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = () => {
      let activeCount = 0;
      provider.awareness.getStates().forEach((state) => {
        if (state && state.user) activeCount++;
      });
      if (activeCount >= expectedCount) {
        provider.awareness.off("change", check);
        clearTimeout(timer);
        resolve();
      }
    };

    const timer = setTimeout(() => {
      provider.awareness.off("change", check);
      const states = Array.from(provider.awareness.getStates().entries());
      reject(
        new Error(
          `Timed out waiting for ${expectedCount} active awareness states. Current count: ${
            states.length
          }, states: ${JSON.stringify(states)}`
        )
      );
    }, timeoutMs);

    provider.awareness.on("change", check);
    check();
  });
}

async function runPresenceTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 6A: Live Cursors & Presence Test Suite");
  console.log("=================================================\n");

  const testSuffix = Date.now().toString().slice(-6);
  let workspaceId: string | null = null;
  let pageId: string | null = null;
  let page2Id: string | null = null;
  let aliceId: string | null = null;
  let bobId: string | null = null;
  let charlieId: string | null = null;
  let danaId: string | null = null;

  const docsToCleanup: Y.Doc[] = [];
  const providersToCleanup: WebsocketProvider[] = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Collaboration Server Health Check & Phase 6A Banner
    // -------------------------------------------------------------
    console.log("TEST 1: Health Check & Server Identification");
    const health = await checkHealth();
    console.log(`  Health response: status=${health.status}, version=${health.version}`);
    if (health.status !== "ok" || !health.version?.startsWith("Phase")) {
      throw new Error(`Collab server not reporting Phase version! Got version: ${health.version}`);
    }
    console.log("  [PASS] Server is healthy and running Phase 6A.\n");

    // -------------------------------------------------------------
    // Setup Test Database Fixtures
    // -------------------------------------------------------------
    console.log("Setting up test database fixtures...");
    const alice = await prisma.user.create({
      data: {
        name: `Alice Owner ${testSuffix}`,
        email: `alice_${testSuffix}@example.com`,
        passwordHash: "hash-not-used-in-collab",
      },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: {
        name: `Bob Member ${testSuffix}`,
        email: `bob_${testSuffix}@example.com`,
        passwordHash: "hash-not-used-in-collab",
      },
    });
    bobId = bob.id;

    const charlie = await prisma.user.create({
      data: {
        name: `Charlie Member ${testSuffix}`,
        email: `charlie_${testSuffix}@example.com`,
        passwordHash: "hash-not-used-in-collab",
      },
    });
    charlieId = charlie.id;

    const dana = await prisma.user.create({
      data: {
        name: `Dana Viewer ${testSuffix}`,
        email: `dana_${testSuffix}@example.com`,
        passwordHash: "hash-not-used-in-collab",
      },
    });
    danaId = dana.id;

    const wsRecord = await createWorkspace(alice.id, {
      name: `Presence WS ${testSuffix}`,
    });
    workspaceId = wsRecord.id;

    await addWorkspaceMember(workspaceId, alice.id, bob.email, WorkspaceRole.MEMBER);
    await addWorkspaceMember(workspaceId, alice.id, charlie.email, WorkspaceRole.MEMBER);
    await addWorkspaceMember(workspaceId, alice.id, dana.email, WorkspaceRole.VIEWER);

    const page1 = await createPage(workspaceId, alice.id, {
      title: "Page 1 Presence Test",
    });
    pageId = page1.id;

    const page2 = await createPage(workspaceId, alice.id, {
      title: "Page 2 Isolated Presence",
    });
    page2Id = page2.id;

    console.log(`  Created workspace=${workspaceId}, page1=${pageId}, page2=${page2Id}\n`);

    const roomName = `${workspaceId}:${pageId}`;

    // -------------------------------------------------------------
    // Test 2: Two Authenticated Collaborators Connect & Exchange Presence
    // -------------------------------------------------------------
    console.log("TEST 2: Two Authenticated Collaborators Exchange Presence");

    const aliceToken = signCollabToken({
      userId: alice.id,
      userName: alice.name,
      workspaceId,
      pageId,
      canEdit: true,
      role: "OWNER",
    });

    const bobToken = signCollabToken({
      userId: bob.id,
      userName: bob.name,
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
    });
    providersToCleanup.push(aliceProvider);

    const bobProvider = new WebsocketProvider(WS_BASE_URL, roomName, bobDoc, {
      params: { token: bobToken },
      disableBc: true,
    });
    providersToCleanup.push(bobProvider);

    await Promise.all([waitForSync(aliceProvider), waitForSync(bobProvider)]);

    // Alice sets her presence state
    aliceProvider.awareness.setLocalStateField("user", {
      userId: alice.id,
      userName: alice.name,
      role: "OWNER",
      canEdit: true,
      color: { name: "Indigo", hex: "#6366f1", bg: "#e0e7ff", text: "#ffffff" },
    });

    // Bob sets his presence state
    bobProvider.awareness.setLocalStateField("user", {
      userId: bob.id,
      userName: bob.name,
      role: "MEMBER",
      canEdit: true,
      color: { name: "Emerald", hex: "#10b981", bg: "#d1fae5", text: "#ffffff" },
    });

    // Wait for awareness to propagate to both peers
    await Promise.all([
      waitForAwarenessCount(aliceProvider, 2),
      waitForAwarenessCount(bobProvider, 2),
    ]);

    // Inspect Bob's awareness map on Alice's client
    const aliceRemoteStates = Array.from(aliceProvider.awareness.getStates().values());
    const bobOnAlice = aliceRemoteStates.find((s) => s.user?.userId === bob.id);
    if (!bobOnAlice || !bobOnAlice.user) {
      throw new Error("Alice did not receive Bob's presence state!");
    }
    console.log(`  Alice received Bob's presence: name="${bobOnAlice.user.userName}", role="${bobOnAlice.user.role}", color=${bobOnAlice.user.color?.hex}`);
    if (bobOnAlice.user.userName !== bob.name || bobOnAlice.user.role !== "MEMBER") {
      throw new Error("Bob's presence received by Alice does not match database user!");
    }

    // Inspect Alice's awareness map on Bob's client
    const bobRemoteStates = Array.from(bobProvider.awareness.getStates().values());
    const aliceOnBob = bobRemoteStates.find((s) => s.user?.userId === alice.id);
    if (!aliceOnBob || !aliceOnBob.user) {
      throw new Error("Bob did not receive Alice's presence state!");
    }
    console.log(`  Bob received Alice's presence: name="${aliceOnBob.user.userName}", role="${aliceOnBob.user.role}", color=${aliceOnBob.user.color?.hex}`);
    if (aliceOnBob.user.userName !== alice.name || aliceOnBob.user.role !== "OWNER") {
      throw new Error("Alice's presence received by Bob does not match database user!");
    }
    console.log("  [PASS] Both peers successfully synchronized online presence.\n");

    // -------------------------------------------------------------
    // Test 3: Authenticated Identity Enforcement & Anti-Spoofing
    // -------------------------------------------------------------
    console.log("TEST 3: Identity Spoofing Protection (Server Overrides Forged Identity)");

    // Bob maliciously tries to override his user name to "SuperAdmin" and role to "OWNER"
    bobProvider.awareness.setLocalStateField("user", {
      userId: "hacked-user-id",
      userName: "SuperAdmin Hacker",
      role: "OWNER",
      canEdit: true,
      color: { hex: "#000000" },
    });

    await sleep(300);

    // Alice checks Bob's state in her awareness instance
    const aliceCheckStates = Array.from(aliceProvider.awareness.getStates().values());
    const sanitizedBob = aliceCheckStates.find((s) => s.user?.userId === bob.id);
    if (!sanitizedBob || !sanitizedBob.user) {
      throw new Error("Sanitized Bob presence not found!");
    }

    console.log(`  Alice sees sanitized Bob name="${sanitizedBob.user.userName}" role="${sanitizedBob.user.role}"`);
    if (sanitizedBob.user.userName === "SuperAdmin Hacker" || sanitizedBob.user.role === "OWNER") {
      throw new Error("SECURITY FAILURE: Server allowed client to forge presence identity!");
    }
    if (sanitizedBob.user.userName !== bob.name || sanitizedBob.user.role !== "MEMBER") {
      throw new Error("Server did not enforce authenticated user name and role!");
    }
    console.log("  [PASS] Server strictly enforced authenticated identity and dropped forged metadata.\n");

    // -------------------------------------------------------------
    // Test 4: Live Caret / Cursor Position Propagation
    // -------------------------------------------------------------
    console.log("TEST 4: Live Cursor / Selection Position Propagation");

    aliceProvider.awareness.setLocalStateField("cursor", {
      anchor: 12,
      head: 25,
      timestamp: Date.now(),
    });

    await sleep(250);

    const bobViewsAlice = Array.from(bobProvider.awareness.getStates().values()).find(
      (s) => s.user?.userId === alice.id
    );
    if (!bobViewsAlice || !bobViewsAlice.cursor) {
      throw new Error("Bob did not receive Alice's cursor updates!");
    }
    console.log(`  Bob received Alice's cursor: anchor=${bobViewsAlice.cursor.anchor}, head=${bobViewsAlice.cursor.head}`);
    if (bobViewsAlice.cursor.anchor !== 12 || bobViewsAlice.cursor.head !== 25) {
      throw new Error("Cursor coordinates did not match transmitted position!");
    }
    console.log("  [PASS] Live cursor position propagated cleanly in real time.\n");

    // -------------------------------------------------------------
    // Test 5: Room Scoping & Presence Isolation
    // -------------------------------------------------------------
    console.log("TEST 5: Room Scoping & Presence Isolation Between Pages");

    const page2RoomName = `${workspaceId}:${page2Id}`;
    const charlieToken = signCollabToken({
      userId: charlie.id,
      userName: charlie.name,
      workspaceId,
      pageId: page2Id,
      canEdit: true,
      role: "MEMBER",
    });

    const charlieDoc = new Y.Doc();
    docsToCleanup.push(charlieDoc);

    const charlieProvider = new WebsocketProvider(WS_BASE_URL, page2RoomName, charlieDoc, {
      params: { token: charlieToken },
      disableBc: true,
    });
    providersToCleanup.push(charlieProvider);

    await waitForSync(charlieProvider);

    charlieProvider.awareness.setLocalStateField("user", {
      userId: charlie.id,
      userName: charlie.name,
      role: "MEMBER",
      canEdit: true,
      color: { name: "Amber", hex: "#d97706", bg: "#fef3c7", text: "#ffffff" },
    });

    await sleep(300);

    // Verify Charlie in Page 2 does NOT appear in Page 1 (Alice or Bob)
    const page1Users = Array.from(aliceProvider.awareness.getStates().values());
    const charlieInPage1 = page1Users.find((s) => s.user?.userId === charlie.id);
    if (charlieInPage1) {
      throw new Error("Data leakage: Charlie's presence in Page 2 leaked into Page 1!");
    }

    // Verify Alice in Page 1 does NOT appear in Page 2 (Charlie)
    const page2Users = Array.from(charlieProvider.awareness.getStates().values());
    const aliceInPage2 = page2Users.find((s) => s.user?.userId === alice.id);
    if (aliceInPage2) {
      throw new Error("Data leakage: Alice's presence in Page 1 leaked into Page 2!");
    }
    console.log("  [PASS] Complete presence isolation between rooms; zero cross-page leakage.\n");

    // -------------------------------------------------------------
    // Test 6: Stale Presence Clearing on Disconnect
    // -------------------------------------------------------------
    console.log("TEST 6: Stale Presence Clearing upon Client Disconnect");

    console.log("  Disconnecting Bob's WebSocket connection...");
    const bobClientId = bobProvider.awareness.clientID;
    bobProvider.destroy();

    // Wait for Alice to receive the awareness change reflecting Bob's departure
    await sleep(400);

    const aliceAwarenessAfterBobDisconnect = aliceProvider.awareness.getStates();
    const bobState = aliceAwarenessAfterBobDisconnect.get(bobClientId);
    if (bobState !== undefined && bobState !== null) {
      throw new Error("Bob's presence state was not cleared on Alice after Bob disconnected!");
    }

    let remainingUsers = 0;
    aliceAwarenessAfterBobDisconnect.forEach((s) => {
      if (s && s.user) remainingUsers++;
    });
    console.log(`  Active users remaining on Alice's client: ${remainingUsers} (Expected: 1 - Alice only)`);
    if (remainingUsers !== 1) {
      throw new Error(`Expected exactly 1 user remaining, found ${remainingUsers}`);
    }
    console.log("  [PASS] Stale presence cleanly purged immediately upon client disconnect.\n");

    // -------------------------------------------------------------
    // Test 7: Viewer Presence & Edit Lockdown
    // -------------------------------------------------------------
    console.log("TEST 7: Viewer Presence Visible with Zero Edit Permissions");

    const danaToken = signCollabToken({
      userId: dana.id,
      userName: dana.name,
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
    });
    providersToCleanup.push(danaProvider);

    await waitForSync(danaProvider);

    danaProvider.awareness.setLocalStateField("user", {
      userId: dana.id,
      userName: dana.name,
      role: "VIEWER",
      canEdit: false,
      color: { name: "Rose", hex: "#e11d48", bg: "#ffe4e6", text: "#ffffff" },
    });

    await sleep(350);

    // Alice should see Dana as VIEWER
    const aliceStatesWithDana = Array.from(aliceProvider.awareness.getStates().values());
    const danaOnAlice = aliceStatesWithDana.find((s) => s.user?.userId === dana.id);
    if (!danaOnAlice || !danaOnAlice.user) {
      throw new Error("Alice did not receive Dana's viewer presence!");
    }
    console.log(`  Alice sees Dana online: role="${danaOnAlice.user.role}", canEdit=${danaOnAlice.user.canEdit}`);
    if (danaOnAlice.user.role !== "VIEWER" || danaOnAlice.user.canEdit !== false) {
      throw new Error("Dana's viewer role or canEdit permission not preserved in presence!");
    }

    // Dana tries to mutate the document
    const danaText = danaDoc.getText("live_collaboration_text");
    const aliceText = aliceDoc.getText("live_collaboration_text");
    const initialText = aliceText.toString();

    danaText.insert(0, "Unauthorized viewer text!");
    await sleep(250);

    if (aliceText.toString() !== initialText) {
      throw new Error("SECURITY FAILURE: Viewer was able to mutate collaborative text!");
    }
    console.log("  [PASS] Viewer has visible presence but write operations remain strictly locked down.\n");

    console.log("=================================================");
    console.log("ALL PRESENCE TESTS PASSED (7/7)! 100% SUCCESS");
    console.log("=================================================");
  } finally {
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

    if (workspaceId && aliceId) {
      console.log("\n[Cleanup] Deleting test workspace and users...");
      await sleep(1000);
      try {
        await deleteWorkspace(workspaceId, aliceId);
      } catch {}
    }
    if (aliceId || bobId || charlieId || danaId) {
      await prisma.user
        .deleteMany({
          where: {
            id: {
              in: [aliceId, bobId, charlieId, danaId].filter(Boolean) as string[],
            },
          },
        })
        .catch(() => {});
      console.log("[Cleanup] Database fixtures deleted.");
    }
  }
}

runPresenceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
  });
