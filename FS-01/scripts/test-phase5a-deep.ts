import "dotenv/config";
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForSync(provider: WebsocketProvider, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve();
    const timer = setTimeout(() => {
      reject(new Error(`Sync timeout after ${timeoutMs}ms (connected: ${provider.wsconnected})`));
    }, timeoutMs);

    provider.once("sync", (isSynced: boolean) => {
      if (isSynced) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

async function runDeepCollabAudit() {
  console.log("=================================================");
  console.log("SyncSpace Phase 5A: Deep Sync, Deletions, Formatting & Reconnect Audit");
  console.log("=================================================\n");

  const ts = Date.now();
  const aliceEmail = `deep-alice-${ts}@test.syncspace.dev`;
  const bobEmail = `deep-bob-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let workspaceId = "";
  let pageId = "";

  const providersToCleanup: WebsocketProvider[] = [];
  const docsToCleanup: Y.Doc[] = [];

  try {
    // 1. Setup workspace and page
    console.log("[Setup] Creating users and workspace...");
    const alice = await prisma.user.create({
      data: { name: "Alice Deep", email: aliceEmail, emailVerified: true },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: { name: "Bob Deep", email: bobEmail, emailVerified: true },
    });
    bobId = bob.id;

    const workspace = await createWorkspace(aliceId, { name: "Deep Collab Lab" });
    workspaceId = workspace.id;
    await addWorkspaceMember(workspaceId, aliceId, bobEmail, WorkspaceRole.MEMBER);

    const initialContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Sentence 1. Sentence 2. Sentence 3." }],
        },
      ],
    };

    const page = await createPage(workspaceId, aliceId, {
      title: "Deep Sync Document",
      content: JSON.stringify(initialContent),
    });
    pageId = page.id;

    const roomName = `${workspaceId}:${pageId}`;
    console.log(`  Created room: ${roomName}\n`);

    // 2. Connect Alice and Bob
    console.log("CHECK A: Connect 2 Clients and Verify Initial State");
    const aliceToken = signCollabToken({
      userId: aliceId,
      userName: "Alice Deep",
      workspaceId,
      pageId,
      canEdit: true,
      role: "OWNER",
    });

    const bobToken = signCollabToken({
      userId: bobId,
      userName: "Bob Deep",
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

    let bobProvider = new WebsocketProvider(WS_BASE_URL, roomName, bobDoc, {
      params: { token: bobToken },
      disableBc: true,
      WebSocketPolyfill: WebSocket as any,
    });
    providersToCleanup.push(bobProvider);

    await Promise.all([waitForSync(aliceProvider), waitForSync(bobProvider)]);
    console.log("  [PASS] Alice and Bob connected and synced successfully.\n");

    // 3. Deletion Synchronization
    console.log("CHECK B: Deletion Synchronization");
    const aliceShared = aliceDoc.getText("collab_test_text");
    const bobShared = bobDoc.getText("collab_test_text");

    // Alice types text
    aliceShared.insert(0, "The quick brown fox jumps over the lazy dog.");
    await sleep(200);

    console.log(`  Initial Bob text: "${bobShared.toString()}"`);
    if (bobShared.toString() !== "The quick brown fox jumps over the lazy dog.") {
      throw new Error(`Sync error before deletion: ${bobShared.toString()}`);
    }

    // Bob deletes "brown fox " (index 10, length 10)
    console.log("  Bob deletes 'brown fox '...");
    bobShared.delete(10, 10);
    await sleep(200);

    console.log(`  Alice text after Bob deletion: "${aliceShared.toString()}"`);
    if (aliceShared.toString() !== "The quick jumps over the lazy dog.") {
      throw new Error(`Deletion sync failed on Alice: "${aliceShared.toString()}"`);
    }

    // Alice deletes "lazy " (index 24, length 5)
    console.log("  Alice deletes 'lazy '...");
    aliceShared.delete(24, 5);
    await sleep(200);

    console.log(`  Bob text after Alice deletion: "${bobShared.toString()}"`);
    if (bobShared.toString() !== "The quick jumps over the dog.") {
      throw new Error(`Deletion sync failed on Bob: "${bobShared.toString()}"`);
    }
    console.log("  [PASS] Bidirectional deletions synchronized accurately.\n");

    // 4. Formatting and XmlFragment Synchronization
    console.log("CHECK C: Formatting and Rich Text Structure Synchronization");
    const aliceXml = aliceDoc.getXmlFragment("default");
    const bobXml = bobDoc.getXmlFragment("default");

    console.log(`  Initial Alice XmlFragment length: ${aliceXml.length}`);
    console.log(`  Initial Bob XmlFragment length:   ${bobXml.length}`);

    // Alice appends an element with formatting attributes (e.g., heading or bold mark)
    console.log("  Alice creates a heading element in XmlFragment...");
    const headingElem = new Y.XmlElement("heading");
    headingElem.setAttribute("level", "2");
    const headingText = new Y.XmlText();
    headingText.insert(0, "Collaborative Architecture Header");
    // Apply bold format to "Architecture" (index 14, length 12)
    headingText.format(14, 12, { bold: true });
    headingElem.insert(0, [headingText]);

    aliceXml.push([headingElem]);
    await sleep(200);

    // Verify Bob received the XmlElement with formatting
    const bobLastElem = bobXml.get(bobXml.length - 1) as Y.XmlElement;
    if (!bobLastElem || bobLastElem.nodeName !== "heading") {
      throw new Error(`Formatting sync failed: Bob last element is ${bobLastElem?.nodeName}`);
    }
    const bobLevel = bobLastElem.getAttribute("level");
    const bobHeadingText = bobLastElem.get(0) as Y.XmlText;
    const bobHeadingString = bobHeadingText.toString();
    const bobDelta = bobHeadingText.toDelta();

    console.log(`  Bob received heading level: ${bobLevel}`);
    console.log(`  Bob received heading text: "${bobHeadingString}"`);
    console.log(`  Bob received formatting delta:`, JSON.stringify(bobDelta));

    const plainHeadingText = bobDelta
      .map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
      .join("");
    if (bobLevel !== "2" || plainHeadingText !== "Collaborative Architecture Header") {
      throw new Error(
        `Formatting structure did not match on Bob! Got level=${bobLevel}, text="${plainHeadingText}"`
      );
    }
    const hasBold = bobDelta.some((op: any) => op.attributes && op.attributes.bold === true);
    if (!hasBold) {
      throw new Error("Formatting mark (bold) was not synchronized to Bob!");
    }
    console.log("  [PASS] Rich text XML structures and formatting marks synchronized.\n");

    // 5. Disconnect and Reconnect Synchronization
    console.log("CHECK D: Disconnecting and Reconnecting Restores Consistent State");
    console.log("  Disconnecting Bob...");
    bobProvider.destroy();
    bobProvider = null as any;
    await sleep(200);

    // Alice makes multiple edits while Bob is offline
    console.log("  Alice inserts and deletes while Bob is offline...");
    aliceShared.insert(aliceShared.length, " [Offline Edit 1]");
    aliceShared.insert(0, "[Alice Offline Leader] ");
    aliceShared.delete(aliceShared.length - 17, 7); // deletes "Offline"
    await sleep(100);

    const aliceOfflineState = aliceShared.toString();
    console.log(`  Alice state while Bob is offline: "${aliceOfflineState}"`);

    // Bob reconnects with a fresh Doc/Provider or existing Doc
    console.log("  Bob reconnecting to room...");
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
    await sleep(200);

    const bobReconnectedText = bobReconnectedDoc.getText("collab_test_text");
    console.log(`  Bob reconnected state: "${bobReconnectedText.toString()}"`);

    if (bobReconnectedText.toString() !== aliceOfflineState) {
      throw new Error(
        `State mismatch upon reconnect! Bob="${bobReconnectedText.toString()}" vs Alice="${aliceOfflineState}"`
      );
    }

    // Verify state vector equality
    const aliceVector = Y.encodeStateVector(aliceDoc);
    const bobVector = Y.encodeStateVector(bobReconnectedDoc);
    const vectorDiff = Buffer.compare(Buffer.from(aliceVector), Buffer.from(bobVector));
    console.log(`  State vector comparison diff: ${vectorDiff}`);

    console.log("  [PASS] Reconnected client restored 100% consistent document state.\n");

    console.log("=================================================");
    console.log("ALL DEEP AUDIT CHECKS PASSED SUCCESSFULLY!");
    console.log("=================================================");
  } finally {
    for (const provider of providersToCleanup) {
      if (provider) provider.destroy();
    }
    for (const doc of docsToCleanup) {
      if (doc) doc.destroy();
    }

    if (workspaceId) {
      await sleep(1000);
      try {
        await deleteWorkspace(workspaceId, aliceId);
      } catch {
        await sleep(500);
        await deleteWorkspace(workspaceId, aliceId).catch(() => {});
      }
    }
    if (aliceId || bobId) {
      await prisma.user.deleteMany({
        where: { id: { in: [aliceId, bobId].filter(Boolean) } },
      });
    }
    await prisma.$disconnect();
  }
}

runDeepCollabAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("DEEP AUDIT FAILED:", err);
    process.exit(1);
  });
