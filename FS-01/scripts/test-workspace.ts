import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceForUser,
  renameWorkspace,
  deleteWorkspace,
  addWorkspaceMember,
  removeWorkspaceMember,
  createPage,
  getPageForUser,
  updatePage,
  deletePage,
  WorkspaceError,
} from "../src/lib/services/workspace";

async function runWorkspaceTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 3B: Workspace Management Test Suite");
  console.log("=================================================\n");

  const ts = Date.now();
  const aliceEmail = `alice-ws-${ts}@test.syncspace.dev`;
  const bobEmail = `bob-ws-${ts}@test.syncspace.dev`;
  const charlieEmail = `charlie-ws-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let charlieId = "";
  let workspaceId = "";
  let pageId = "";

  try {
    // 0. Setup test users
    console.log("[Setup] Creating test users (Alice = Owner, Bob = Collab, Charlie = Intruder)...");
    const alice = await prisma.user.create({
      data: {
        name: "Alice Owner",
        email: aliceEmail,
        emailVerified: true,
      },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: {
        name: "Bob Collab",
        email: bobEmail,
        emailVerified: true,
      },
    });
    bobId = bob.id;

    const charlie = await prisma.user.create({
      data: {
        name: "Charlie Intruder",
        email: charlieEmail,
        emailVerified: true,
      },
    });
    charlieId = charlie.id;
    console.log("-> 3 test users created successfully.");

    // 1. Test Workspace Creation with DB Transaction
    console.log("\n[Test 1] Testing Workspace Creation with Atomic DB Transaction...");
    const workspace = await createWorkspace(aliceId, { name: "Core Engineering" });
    workspaceId = workspace.id;

    if (workspace.ownerId !== aliceId) {
      throw new Error(`OwnerId mismatch: expected ${aliceId}, got ${workspace.ownerId}`);
    }

    const aliceMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: aliceId,
        },
      },
    });

    if (!aliceMembership || aliceMembership.role !== "OWNER") {
      throw new Error("Atomic transaction failed: OWNER membership record not created.");
    }
    console.log("-> PASS: Workspace created with Alice as OWNER and corresponding membership record verified.");

    // 2. Test Name Validation
    console.log("\n[Test 2] Testing Name Validation on Workspace Creation...");
    let caughtNameError = false;
    try {
      await createWorkspace(aliceId, { name: " " });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 400) {
        caughtNameError = true;
      }
    }
    if (!caughtNameError) {
      throw new Error("Validation failure: Blank workspace name was not rejected.");
    }
    console.log("-> PASS: Blank/invalid workspace names properly rejected with 400 Bad Request.");

    // 3. Test Unauthorized Access Prevention
    console.log("\n[Test 3] Testing Unauthorized Access Prevention (Charlie as non-member)...");
    const charlieView = await getWorkspaceForUser(workspaceId, charlieId);
    if (charlieView !== null) {
      throw new Error("SECURITY BREACH: Non-member Charlie was able to view Alice's workspace!");
    }

    let charlieRenameBlocked = false;
    try {
      await renameWorkspace(workspaceId, charlieId, "Hacked Workspace");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && (err.status === 403 || err.status === 404)) {
        charlieRenameBlocked = true;
      }
    }
    if (!charlieRenameBlocked) {
      throw new Error("SECURITY BREACH: Non-member Charlie was able to rename workspace!");
    }

    let charlieDeleteBlocked = false;
    try {
      await deleteWorkspace(workspaceId, charlieId);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && (err.status === 403 || err.status === 404)) {
        charlieDeleteBlocked = true;
      }
    }
    if (!charlieDeleteBlocked) {
      throw new Error("SECURITY BREACH: Non-member Charlie was able to delete workspace!");
    }
    console.log("-> PASS: Non-members are completely blocked from viewing, renaming, or deleting workspaces.");

    // 4. Test Membership and Role Enforcement: Viewer Role
    console.log("\n[Test 4] Testing Member Invitation and VIEWER Role Enforcement...");
    const bobMember = await addWorkspaceMember(workspaceId, aliceId, bobEmail, "VIEWER");
    if (bobMember.role !== "VIEWER") {
      throw new Error(`Expected VIEWER role, got ${bobMember.role}`);
    }

    const bobWorkspaceView = await getWorkspaceForUser(workspaceId, bobId);
    if (!bobWorkspaceView || bobWorkspaceView.currentUserRole !== "VIEWER") {
      throw new Error("Bob cannot view workspace or role is incorrect.");
    }
    if (bobWorkspaceView.canEdit || bobWorkspaceView.canDelete || bobWorkspaceView.canCreatePage) {
      throw new Error("Role permission violation: VIEWER should not have edit/delete/createPage permissions.");
    }

    // Viewer attempting to rename
    let viewerRenameBlocked = false;
    try {
      await renameWorkspace(workspaceId, bobId, "Bob's Workspace");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        viewerRenameBlocked = true;
      }
    }
    if (!viewerRenameBlocked) {
      throw new Error("SECURITY FAILURE: VIEWER was allowed to rename workspace!");
    }

    // Viewer attempting to create page
    let viewerPageBlocked = false;
    try {
      await createPage(workspaceId, bobId, { title: "Unauthorized Page" });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        viewerPageBlocked = true;
      }
    }
    if (!viewerPageBlocked) {
      throw new Error("SECURITY FAILURE: VIEWER was allowed to create page!");
    }
    console.log("-> PASS: VIEWER role strictly enforced on server; rename and page creation blocked.");

    // 5. Test Role Upgrade and Admin Permissions
    console.log("\n[Test 5] Testing Role Upgrade to ADMIN & Renaming Permissions...");
    await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: bobId,
        },
      },
      data: { role: "ADMIN" },
    });

    const renamed = await renameWorkspace(workspaceId, bobId, "Core Engineering & Architecture");
    if (renamed.name !== "Core Engineering & Architecture") {
      throw new Error("ADMIN failed to rename workspace.");
    }

    // Admin should NOT be allowed to delete workspace (only OWNER)
    let adminDeleteBlocked = false;
    try {
      await deleteWorkspace(workspaceId, bobId);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        adminDeleteBlocked = true;
      }
    }
    if (!adminDeleteBlocked) {
      throw new Error("SECURITY FAILURE: ADMIN was allowed to delete workspace (must be OWNER only)!");
    }
    console.log("-> PASS: ADMIN permitted to rename, but deletion restricted exclusively to OWNER.");

    // 6. Test Page Management (Creation, Retrieval, Scoping, Update)
    console.log("\n[Test 6] Testing Page Management & Scoping...");
    const page = await createPage(workspaceId, aliceId, {
      title: "Architecture Roadmap",
      content: "Initial system specifications for Phase 3B.",
    });
    pageId = page.id;

    if (page.title !== "Architecture Roadmap" || page.workspaceId !== workspaceId) {
      throw new Error("Page creation failed or scoping invalid.");
    }

    // Non-member cannot read page
    const charliePage = await getPageForUser(workspaceId, pageId, charlieId);
    if (charliePage !== null) {
      throw new Error("SECURITY BREACH: Non-member Charlie was able to read workspace page!");
    }

    // Member can read page
    const bobPage = await getPageForUser(workspaceId, pageId, bobId);
    if (!bobPage || bobPage.title !== "Architecture Roadmap") {
      throw new Error("Member Bob could not read workspace page.");
    }

    // Update page
    const updatedPage = await updatePage(workspaceId, pageId, bobId, {
      title: "Architecture Roadmap v2",
      content: "Updated specifications with high-throughput notes.",
    });
    if (updatedPage.title !== "Architecture Roadmap v2") {
      throw new Error("Failed to update page.");
    }

    // Verify workspace listing shows the page
    const wsDetails = await getWorkspaceForUser(workspaceId, aliceId);
    if (!wsDetails || wsDetails.pages.length !== 1) {
      throw new Error(`Expected 1 page in workspace listing, got ${wsDetails?.pages.length}`);
    }

    const aliceWorkspaces = await getUserWorkspaces(aliceId);
    if (aliceWorkspaces.length !== 1) {
      throw new Error(`Expected 1 workspace in Alice's dashboard list, got ${aliceWorkspaces.length}`);
    }

    // Create a secondary page to test individual deletePage
    const tempPage = await createPage(workspaceId, bobId, { title: "Draft Notes" });
    await deletePage(workspaceId, tempPage.id, bobId);
    const deletedTempPage = await getPageForUser(workspaceId, tempPage.id, bobId);
    if (deletedTempPage !== null) {
      throw new Error("deletePage failed: Page still exists after deletion.");
    }
    console.log("-> PASS: Page creation, retrieval, scoping, updates, and deletion verified.");

    // 7. Test Member Removal
    console.log("\n[Test 7] Testing Member Removal...");
    await removeWorkspaceMember(workspaceId, aliceId, bobMember.id);
    const bobRevokedView = await getWorkspaceForUser(workspaceId, bobId);
    if (bobRevokedView !== null) {
      throw new Error("SECURITY FAILURE: Removed member Bob still has access to workspace!");
    }
    console.log("-> PASS: Removed member immediately loses all access.");

    // 8. Test Workspace Deletion & Cascading
    console.log("\n[Test 8] Testing Workspace Deletion by OWNER & Cascading Cleanup...");
    await deleteWorkspace(workspaceId, aliceId);

    const deletedWs = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (deletedWs !== null) {
      throw new Error("Workspace record still exists after deletion.");
    }

    const remainingPages = await prisma.page.findMany({ where: { workspaceId } });
    if (remainingPages.length > 0) {
      throw new Error("Orphaned pages found after workspace deletion.");
    }
    console.log("-> PASS: Workspace deleted by OWNER with clean cascading cleanup.");

    console.log("\n=======================================================");
    console.log("ALL 8 WORKSPACE MANAGEMENT TESTS PASSED (100%)!");
    console.log("=======================================================\n");
  } catch (error: unknown) {
    console.error("\nTEST SUITE FAILED:");
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup test users
    console.log("[Teardown] Cleaning up test records from database...");
    if (aliceId) await prisma.user.delete({ where: { id: aliceId } }).catch(() => {});
    if (bobId) await prisma.user.delete({ where: { id: bobId } }).catch(() => {});
    if (charlieId) await prisma.user.delete({ where: { id: charlieId } }).catch(() => {});
    await prisma.$disconnect();
    console.log("-> Teardown complete.\n");
    process.exit(0);
  }
}

runWorkspaceTests();
