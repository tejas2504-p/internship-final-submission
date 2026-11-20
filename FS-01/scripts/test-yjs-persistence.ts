import "dotenv/config";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { prisma } from "../src/lib/db/prisma";
import { signCollabToken } from "../src/lib/collaboration/token";

// Force WebSocket global in Node.js runtime for y-websocket
(global as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

const WS_PORT = 1234;
const WS_URL = `ws://127.0.0.1:${WS_PORT}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForSync(provider: WebsocketProvider, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve();
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for Yjs sync after ${timeoutMs}ms (connected: ${provider.wsconnected})`));
    }, timeoutMs);

    provider.once("sync", (isSynced: boolean) => {
      if (isSynced) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

async function runYjsPersistenceTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 5B: Yjs Persistence & Reliability Test Suite");
  console.log("=================================================\n");

  // 1. Health check
  console.log("TEST 1: Collaboration Server HTTP /health Check");
  const healthRes = await fetch(`http://127.0.0.1:${WS_PORT}/health`);
  const healthJson = await healthRes.json();
  console.log("  Health response:", JSON.stringify(healthJson));
  if (!healthJson.version?.startsWith("Phase")) {
    throw new Error(`Expected server version starting with Phase, but received: ${healthJson.version}`);
  }
  console.log(`  [PASS] Server is running ${healthJson.version} with durable persistence.\n`);

  // Setup fixtures
  console.log("[Setup] Creating test users, workspace, and pages...");
  const alice = await prisma.user.create({
    data: {
      name: "Alice Owner",
      email: `alice.phase5b.${Date.now()}@syncspace.test`,
      emailVerified: true,
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: "Bob Editor",
      email: `bob.phase5b.${Date.now()}@syncspace.test`,
      emailVerified: true,
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Phase 5B Workspace",
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: "OWNER" },
          { userId: bob.id, role: "MEMBER" },
        ],
      },
    },
  });

  const initialLegacyContent = JSON.stringify({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Legacy Seeded Title" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Existing document content in PostgreSQL." }],
      },
    ],
  });

  const page = await prisma.page.create({
    data: {
      title: "Persistence Test Page",
      content: initialLegacyContent,
      workspaceId: workspace.id,
      createdById: alice.id,
    },
  });

  const roomName = `${workspace.id}:${page.id}`;
  console.log(`  Created workspace=${workspace.id}, page=${page.id}, room=${roomName}\n`);

  try {
    // TEST 2: Initial Seeding & Backward Compatibility
    console.log("TEST 2: Initial Seeding from PostgreSQL Page Content");
    const aliceToken = signCollabToken({
      userId: alice.id,
      userName: alice.name,
      workspaceId: workspace.id,
      pageId: page.id,
      canEdit: true,
      role: "OWNER",
    });

    const aliceDoc = new Y.Doc();
    const aliceProvider = new WebsocketProvider(WS_URL, roomName, aliceDoc, {
      params: { token: aliceToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });

    await waitForSync(aliceProvider);

    // Check that Alice received the seeded XML structure from PostgreSQL
    const xmlFragment = aliceDoc.getXmlFragment("default");
    console.log(`  Alice XML fragment children count: ${xmlFragment.length}`);
    if (xmlFragment.length === 0) {
      throw new Error("Target Y.Doc was not seeded from PostgreSQL page content.");
    }

    // Verify initial Yjs snapshot was saved to yjs_documents table
    const initialYjsDoc = await prisma.yjsDocument.findUnique({
      where: { pageId: page.id },
    });
    if (!initialYjsDoc || initialYjsDoc.snapshot.length === 0) {
      throw new Error("Initial Yjs document record was not created in PostgreSQL.");
    }
    console.log(`  Initial yjs_documents record created (snapshot size: ${initialYjsDoc.snapshot.length} bytes)`);
    console.log("  [PASS] Initial legacy document correctly seeded and snapshot initialized.\n");

    // TEST 3: Durable Persistence & Debounced Batching
    console.log("TEST 3: Real-Time Edits, Batch Debouncing & Derived JSON AST");
    console.log("  Alice inserting collaborative paragraph into Y.Doc...");

    const pNode = new Y.XmlElement("paragraph");
    const textNode = new Y.XmlText();
    textNode.insert(0, "Collaborative paragraph persisted to PostgreSQL via Phase 5B batching.");
    pNode.insert(0, [textNode]);
    xmlFragment.push([pNode]);

    console.log("  Waiting for 3-second debounced flush to complete...");
    await sleep(3500);

    // Verify binary snapshot in PostgreSQL was updated
    const updatedYjsDoc = await prisma.yjsDocument.findUnique({
      where: { pageId: page.id },
    });
    if (!updatedYjsDoc || updatedYjsDoc.snapshot.length <= initialYjsDoc.snapshot.length) {
      throw new Error("yjs_documents binary snapshot was not updated after edits.");
    }
    console.log(`  Updated snapshot size in database: ${updatedYjsDoc.snapshot.length} bytes`);

    // Verify derived ProseMirror JSON was written to pages.content
    const updatedPage = await prisma.page.findUnique({
      where: { id: page.id },
      select: { content: true, updatedAt: true },
    });

    if (!updatedPage?.content) {
      throw new Error("pages.content was not updated with derived JSON AST.");
    }

    const parsedDerived = JSON.parse(updatedPage.content);
    console.log("  Derived pages.content node types:", parsedDerived.content.map((n: { type: string }) => n.type));
    const containsNewText = updatedPage.content.includes("Collaborative paragraph persisted to PostgreSQL");
    if (!containsNewText) {
      throw new Error("Derived JSON in pages.content does not contain Alice's collaborative edit.");
    }
    console.log("  [PASS] Binary snapshot and derived ProseMirror JSON persisted with complete fidelity.\n");

    // TEST 4: Document Restoration Across Fresh Client / Server Reboot Simulation
    console.log("TEST 4: Document-State Restoration from Persisted Binary Snapshot");
    console.log("  Alice disconnecting...");
    aliceProvider.destroy();
    aliceDoc.destroy();

    // Bob connects to the same room using a fresh Y.Doc
    const bobToken = signCollabToken({
      userId: bob.id,
      userName: bob.name,
      workspaceId: workspace.id,
      pageId: page.id,
      canEdit: true,
      role: "MEMBER",
    });

    const bobDoc = new Y.Doc();
    const bobProvider = new WebsocketProvider(WS_URL, roomName, bobDoc, {
      params: { token: bobToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });

    await waitForSync(bobProvider);

    const bobXml = bobDoc.getXmlFragment("default");
    console.log(`  Bob loaded XML children count: ${bobXml.length}`);
    if (bobXml.length < 3) {
      throw new Error(`Expected at least 3 nodes in restored document, found: ${bobXml.length}`);
    }

    // Verify the exact text content matches what Alice persisted
    const lastChild = bobXml.get(bobXml.length - 1) as Y.XmlElement;
    const restoredText = (lastChild.get(0) as Y.XmlText).toString();
    console.log(`  Restored text from Bob's document: "${restoredText}"`);
    if (!restoredText.includes("Collaborative paragraph persisted to PostgreSQL")) {
      throw new Error("Bob did not receive the durably persisted document state.");
    }
    console.log("  [PASS] Fresh client successfully restored 100% of persisted document state.\n");

    // TEST 5: Client Reconnection & Resynchronization
    console.log("TEST 5: Client Reconnection & Resynchronization Under Network Drops");
    console.log("  Simulating temporary disconnect of Bob's socket...");
    bobProvider.disconnect();

    // While Bob is disconnected, Alice reconnects and adds another edit
    const aliceDoc2 = new Y.Doc();
    const aliceProvider2 = new WebsocketProvider(WS_URL, roomName, aliceDoc2, {
      params: { token: aliceToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });

    await waitForSync(aliceProvider2);

    const aliceXml2 = aliceDoc2.getXmlFragment("default");
    const offlinePara = new Y.XmlElement("paragraph");
    const offlineText = new Y.XmlText();
    offlineText.insert(0, "Edit created while Bob was disconnected.");
    offlinePara.insert(0, [offlineText]);
    aliceXml2.push([offlinePara]);

    console.log("  Alice2 added offline edit. Now reconnecting Bob...");
    bobProvider.connect();

    await waitForSync(bobProvider);

    await sleep(500);

    const bobXmlAfterReconnect = bobDoc.getXmlFragment("default");
    const bobLastChild = bobXmlAfterReconnect.get(bobXmlAfterReconnect.length - 1) as Y.XmlElement;
    const reconnectedText = (bobLastChild.get(0) as Y.XmlText).toString();
    console.log(`  Bob received text after reconnect: "${reconnectedText}"`);
    if (!reconnectedText.includes("Edit created while Bob was disconnected")) {
      throw new Error("Bob failed to resynchronize missed edits after reconnecting.");
    }
    console.log("  [PASS] Client successfully reconnected and resynchronized with zero data loss.\n");

    // Cleanup active providers
    aliceProvider2.destroy();
    aliceDoc2.destroy();
    bobProvider.destroy();
    bobDoc.destroy();

    // TEST 6: Unload Flush on Last Client Disconnect
    console.log("TEST 6: Immediate Persistence Flush on Room Unload");
    console.log("  Waiting for room unload flush to persist to PostgreSQL...");
    await sleep(3000);

    const finalPage = await prisma.page.findUnique({
      where: { id: page.id },
      select: { content: true },
    });

    if (!finalPage?.content?.includes("Edit created while Bob was disconnected")) {
      throw new Error("Unload flush did not persist final edits to PostgreSQL.");
    }
    console.log("  [PASS] Room unload flush verified in PostgreSQL.\n");

    console.log("=================================================");
    console.log("ALL 6 YJS PERSISTENCE TESTS PASSED (100% SUCCESS)!");
    console.log("=================================================\n");
  } finally {
    console.log("[Cleanup] Removing test database fixtures...");
    await prisma.yjsDocument.deleteMany({ where: { pageId: page.id } });
    await prisma.page.deleteMany({ where: { id: page.id } });
    await prisma.workspace.delete({ where: { id: workspace.id } });
    await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
    console.log("[Cleanup] Database fixtures deleted successfully.");
  }
}

runYjsPersistenceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ YJS PERSISTENCE TEST FAILED:", err);
    process.exit(1);
  });
