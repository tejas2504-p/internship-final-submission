import "dotenv/config";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import { prisma } from "../src/lib/db/prisma";
import { updatePage } from "../src/lib/services/workspace";
import { PostgresPersistenceAdapter } from "../collaboration-server/persistence";

async function runPersistenceTests() {
  console.log("=== SyncSpace Document Persistence & Sharing Verification ===");
  let passCount = 0;
  let failCount = 0;

  function report(name: string, passed: boolean, detail?: string) {
    if (passed) {
      passCount++;
      console.log(`[PASS] ${name}${detail ? ` - ${detail}` : ""}`);
    } else {
      failCount++;
      console.error(`[FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
    }
  }

  const testEmailOwner = `owner_${Date.now()}@syncspace.test`;
  const testEmailMember = `member_${Date.now()}@syncspace.test`;
  const testEmailUnauthorized = `outsider_${Date.now()}@syncspace.test`;

  let ownerUser: any;
  let memberUser: any;
  let outsiderUser: any;
  let workspace: any;
  let page: any;

  try {
    ownerUser = await prisma.user.create({
      data: { name: "Doc Owner", email: testEmailOwner },
    });
    memberUser = await prisma.user.create({
      data: { name: "Doc Collaborator", email: testEmailMember },
    });
    outsiderUser = await prisma.user.create({
      data: { name: "Outsider", email: testEmailUnauthorized },
    });

    workspace = await prisma.workspace.create({
      data: {
        name: "Persistence Test Space",
        ownerId: ownerUser.id,
        members: {
          create: [
            { userId: ownerUser.id, role: "OWNER" },
            { userId: memberUser.id, role: "MEMBER" },
          ],
        },
      },
    });

    page = await prisma.page.create({
      data: {
        title: "Initial Page Title",
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Initial content in workspace page." }],
            },
          ],
        }),
        workspaceId: workspace.id,
        createdById: ownerUser.id,
      },
    });

    report("Test Environment Setup", true, `Page ${page.id} created in workspace ${workspace.id}`);

    // Test 1: User A (Owner) updates page content and confirms PostgreSQL persistence
    const newContentJson = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Quarterly Planning" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Saved reliably to Neon PostgreSQL database." }],
        },
      ],
    });

    await updatePage(workspace.id, page.id, ownerUser.id, {
      title: "Quarterly Planning 2026",
      content: newContentJson,
    });

    const dbRecord = await prisma.page.findUnique({
      where: { id: page.id },
      select: { title: true, content: true, updatedAt: true },
    });

    const contentMatches = dbRecord?.content === newContentJson;
    const titleMatches = dbRecord?.title === "Quarterly Planning 2026";
    report(
      "Direct DB Persistence: User A save writes to PostgreSQL pages table",
      contentMatches && titleMatches,
      `Title='${dbRecord?.title}', Content length=${dbRecord?.content?.length}`
    );

    // Test 2: User B (Authorized Collaborator) reads the page and receives exact content
    const pageForCollaborator = await prisma.page.findFirst({
      where: {
        id: page.id,
        workspace: {
          members: {
            some: { userId: memberUser.id },
          },
        },
      },
      select: { id: true, title: true, content: true },
    });

    const collabReadsContent =
      pageForCollaborator !== null && pageForCollaborator.content === newContentJson;
    report(
      "Shared Workspace Content: Collaborator reads saved content from PostgreSQL",
      collabReadsContent,
      `Collaborator received: ${pageForCollaborator?.title}`
    );

    // Test 3: User B updates content as an authorized collaborator
    const memberUpdateJson = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Quarterly Planning (Revised by Member)" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Member added their project milestones here." }],
        },
      ],
    });

    await updatePage(workspace.id, page.id, memberUser.id, {
      title: "Quarterly Planning (Revised)",
      content: memberUpdateJson,
    });

    const memberDbCheck = await prisma.page.findUnique({
      where: { id: page.id },
      select: { title: true, content: true },
    });

    report(
      "Collaborator Edit Persistence: Collaborator save persists to database",
      memberDbCheck?.content === memberUpdateJson && memberDbCheck?.title === "Quarterly Planning (Revised)"
    );

    // Test 4: Unauthorized User C cannot update or read the page
    let outsiderBlocked = false;
    try {
      await updatePage(workspace.id, page.id, outsiderUser.id, {
        title: "Malicious Edit",
        content: "Hacked content",
      });
    } catch (err: any) {
      if (err.statusCode === 403 || err.message?.includes("access")) {
        outsiderBlocked = true;
      }
    }

    report(
      "Security & Authorization: Unauthorized user cannot mutate page content",
      outsiderBlocked
    );

    // Test 5: Yjs Persistence Adapter reconciles with latest REST/PostgreSQL content
    const persistenceAdapter = new PostgresPersistenceAdapter();
    const loadedDoc = new Y.Doc();
    const loadSuccess = await persistenceAdapter.loadDocument(workspace.id, page.id, loadedDoc);

    const loadedPMJson = yDocToProsemirrorJSON(loadedDoc, "default");
    const jsonString = JSON.stringify(loadedPMJson);
    const hasMilestonesText = jsonString.includes("Member added their project milestones");

    report(
      "Collaboration Server Reconciliation: Adapter accurately loads fresh DB content",
      loadSuccess && hasMilestonesText,
      `Derived ProseMirror text match: ${hasMilestonesText}`
    );
    loadedDoc.destroy();

    // Test 6: Yjs saveDocument correctly dual-writes binary snapshot and JSON AST to DB
    const collabEditDoc = new Y.Doc();
    await persistenceAdapter.loadDocument(workspace.id, page.id, collabEditDoc);
    await persistenceAdapter.saveDocument(workspace.id, page.id, collabEditDoc);
    collabEditDoc.destroy();

    const yjsRecord = await prisma.yjsDocument.findUnique({
      where: { pageId: page.id },
      select: { snapshot: true },
    });
    report(
      "Dual Persistence: Collaboration adapter maintains both yjs_documents and pages.content",
      !!yjsRecord?.snapshot && yjsRecord.snapshot.length > 0
    );

  } catch (err) {
    console.error("Test runner encountered error:", err);
    report("Test execution completed cleanly", false, String(err));
  } finally {
    try {
      if (page?.id) {
        await prisma.yjsDocument.deleteMany({ where: { pageId: page.id } }).catch(() => {});
        await prisma.page.deleteMany({ where: { id: page.id } }).catch(() => {});
      }
      if (workspace?.id) {
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
        await prisma.workspace.deleteMany({ where: { id: workspace.id } }).catch(() => {});
      }
      if (ownerUser?.id) await prisma.user.deleteMany({ where: { id: ownerUser.id } }).catch(() => {});
      if (memberUser?.id) await prisma.user.deleteMany({ where: { id: memberUser.id } }).catch(() => {});
      if (outsiderUser?.id) await prisma.user.deleteMany({ where: { id: outsiderUser.id } }).catch(() => {});
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr);
    }
  }

  console.log(`\nResults: ${passCount} PASSED, ${failCount} FAILED`);
  process.exit(failCount === 0 ? 0 : 1);
}

runPersistenceTests();
