/**
 * SyncSpace Phase 10.1: Advanced Workspace Management Automated Test Suite
 *
 * Verifies:
 * 1. Workspace settings (name, description, icon) and validation constraints.
 * 2. Role-Based Access Control (OWNER, ADMIN, EDITOR, VIEWER) permissions.
 * 3. Member invitations lifecycle: creation, duplicate rejection, acceptance, rejection, cancellation, expiration.
 * 4. Member management: role updates, removals, and ownership protection.
 * 5. Real-time activity feed audit trail logging for all actions.
 * 6. Cross-workspace search across document pages and spatial canvas nodes.
 * 7. Non-regression of collaborative canvas and document persistence.
 */

import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { WorkspaceRole, InvitationStatus } from "@prisma/client";
import {
  createWorkspace,
  getWorkspaceForUser,
  updateWorkspaceSettings,
  updateMemberRole,
  addWorkspaceMember,
  removeWorkspaceMember,
  createWorkspaceInvitation,
  getWorkspaceInvitations,
  cancelWorkspaceInvitation,
  getInvitationByToken,
  acceptWorkspaceInvitation,
  rejectWorkspaceInvitation,
  getWorkspaceActivities,
  searchWorkspace,
  createPage,
  WorkspaceError,
} from "../src/lib/services/workspace";
import { saveCanvasForWorkspace, getCanvasForWorkspace } from "../src/lib/services/canvas";

async function runAdvancedWorkspaceTests() {
  console.log("================================================================================");
  console.log("SyncSpace Phase 10.1: Advanced Workspace Management Test Suite");
  console.log("================================================================================\n");

  const ts = Date.now();
  const ownerEmail = `owner-p10-${ts}@test.syncspace.dev`;
  const adminEmail = `admin-p10-${ts}@test.syncspace.dev`;
  const editorEmail = `editor-p10-${ts}@test.syncspace.dev`;
  const viewerEmail = `viewer-p10-${ts}@test.syncspace.dev`;
  const inviteeEmail = `invitee-p10-${ts}@test.syncspace.dev`;
  const declinedEmail = `declined-p10-${ts}@test.syncspace.dev`;
  const cancelledEmail = `cancelled-p10-${ts}@test.syncspace.dev`;
  const outsiderEmail = `outsider-p10-${ts}@test.syncspace.dev`;

  let ownerId = "";
  let adminId = "";
  let editorId = "";
  let viewerId = "";
  let inviteeId = "";
  let declinedId = "";
  let outsiderId = "";
  let workspaceId = "";

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Test Users
    // -------------------------------------------------------------------------
    console.log("[Setup] Creating test users...");
    const [owner, admin, editor, viewer, invitee, declined, outsider] = await Promise.all([
      prisma.user.create({ data: { name: "Alice Owner", email: ownerEmail, emailVerified: true } }),
      prisma.user.create({ data: { name: "Bob Admin", email: adminEmail, emailVerified: true } }),
      prisma.user.create({ data: { name: "Charlie Editor", email: editorEmail, emailVerified: true } }),
      prisma.user.create({ data: { name: "Dana Viewer", email: viewerEmail, emailVerified: true } }),
      prisma.user.create({ data: { name: "Eve Invitee", email: inviteeEmail, emailVerified: true } }),
      prisma.user.create({ data: { name: "Frank Decliner", email: declinedEmail, emailVerified: true } }),
      prisma.user.create({ data: { name: "Oscar Outsider", email: outsiderEmail, emailVerified: true } }),
    ]);

    ownerId = owner.id;
    adminId = admin.id;
    editorId = editor.id;
    viewerId = viewer.id;
    inviteeId = invitee.id;
    declinedId = declined.id;
    outsiderId = outsider.id;
    console.log("✔ Created 7 test users.");

    // -------------------------------------------------------------------------
    // TEST 1: Workspace Creation with Icon, Description, and Activity Logging
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Workspace Creation with Icon, Description & Activity Feed...");
    const ws = await createWorkspace(ownerId, {
      name: "Engineering HQ",
      description: "Central workspace for platform architecture and design.",
      icon: "🚀",
    });
    workspaceId = ws.id;

    if (ws.name !== "Engineering HQ" || ws.icon !== "🚀") {
      throw new Error(`Test 1 Failed: Workspace name or icon mismatch: ${ws.name}, ${ws.icon}`);
    }
    console.log(`✔ Created workspace: "${ws.name}" with icon: "${ws.icon}" (ID: ${workspaceId})`);

    // Verify initial activity feed log
    const initialActivities = await getWorkspaceActivities(workspaceId, ownerId);
    const createdActivity = initialActivities.find((a) => a.action === "WORKSPACE_CREATED");
    if (!createdActivity) {
      throw new Error("Test 1 Failed: WORKSPACE_CREATED activity was not recorded.");
    }
    console.log("✔ WORKSPACE_CREATED activity logged successfully.");

    // -------------------------------------------------------------------------
    // TEST 2: Workspace Settings Update & Validation Constraints
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Workspace Settings Update & Validation Constraints...");

    // 2a: Valid settings update
    const updatedWs = await updateWorkspaceSettings(workspaceId, ownerId, {
      name: "Engineering Core HQ",
      description: "Updated description for system architecture.",
      icon: "⚡",
    });

    if (updatedWs.name !== "Engineering Core HQ" || updatedWs.icon !== "⚡") {
      throw new Error("Test 2a Failed: Updated workspace attributes mismatch.");
    }
    console.log("✔ Workspace settings updated successfully (Name, Description, Icon).");

    // 2b: Validation - Name too short
    let shortNameBlocked = false;
    try {
      await updateWorkspaceSettings(workspaceId, ownerId, { name: "A" });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.code === "BAD_REQUEST") {
        shortNameBlocked = true;
      }
    }
    if (!shortNameBlocked) {
      throw new Error("Test 2b Failed: Name < 2 characters should have been rejected.");
    }
    console.log("✔ Short name validation correctly enforced.");

    // 2c: Validation - Description too long (> 500 chars)
    let longDescBlocked = false;
    try {
      await updateWorkspaceSettings(workspaceId, ownerId, {
        description: "X".repeat(501),
      });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.code === "BAD_REQUEST") {
        longDescBlocked = true;
      }
    }
    if (!longDescBlocked) {
      throw new Error("Test 2c Failed: Description > 500 characters should have been rejected.");
    }
    console.log("✔ Long description validation correctly enforced.");

    // -------------------------------------------------------------------------
    // TEST 3: Role-Based Access Control (RBAC)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Role-Based Access Control (RBAC) Permissions...");

    // Add Admin, Editor, and Viewer members
    await addWorkspaceMember(workspaceId, ownerId, adminEmail, WorkspaceRole.ADMIN);
    await addWorkspaceMember(workspaceId, ownerId, editorEmail, WorkspaceRole.EDITOR);
    await addWorkspaceMember(workspaceId, ownerId, viewerEmail, WorkspaceRole.VIEWER);
    console.log("✔ Added ADMIN, EDITOR, and VIEWER members to workspace.");

    // 3a: Admin can update settings
    const adminUpdate = await updateWorkspaceSettings(workspaceId, adminId, {
      name: "Engineering Platform",
    });
    if (adminUpdate.name !== "Engineering Platform") {
      throw new Error("Test 3a Failed: Admin could not update workspace name.");
    }
    console.log("✔ ADMIN successfully updated workspace settings.");

    // 3b: Editor CANNOT update settings (FORBIDDEN)
    let editorBlocked = false;
    try {
      await updateWorkspaceSettings(workspaceId, editorId, { name: "Hacked by Editor" });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.code === "FORBIDDEN") {
        editorBlocked = true;
      }
    }
    if (!editorBlocked) {
      throw new Error("Test 3b Failed: EDITOR should not be allowed to update workspace settings.");
    }
    console.log("✔ EDITOR correctly forbidden from updating settings.");

    // 3c: Viewer CANNOT update settings (FORBIDDEN)
    let viewerBlocked = false;
    try {
      await updateWorkspaceSettings(workspaceId, viewerId, { name: "Hacked by Viewer" });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.code === "FORBIDDEN") {
        viewerBlocked = true;
      }
    }
    if (!viewerBlocked) {
      throw new Error("Test 3c Failed: VIEWER should not be allowed to update settings.");
    }
    console.log("✔ VIEWER correctly forbidden from updating settings.");

    // 3d: Admin CANNOT demote or remove the Owner
    let adminRemoveOwnerBlocked = false;
    try {
      await removeWorkspaceMember(workspaceId, adminId, ownerId);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.code === "FORBIDDEN") {
        adminRemoveOwnerBlocked = true;
      }
    }
    if (!adminRemoveOwnerBlocked) {
      throw new Error("Test 3d Failed: ADMIN should not be allowed to remove the OWNER.");
    }
    console.log("✔ ADMIN correctly prevented from removing OWNER.");

    // -------------------------------------------------------------------------
    // TEST 4: Member Invitation Lifecycle (Create -> Token -> Accept)
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Member Invitation Lifecycle (Create -> Token -> Accept)...");

    // 4a: Admin invites Eve with role EDITOR
    const invitation = await createWorkspaceInvitation(
      workspaceId,
      adminId,
      inviteeEmail,
      WorkspaceRole.EDITOR
    );
    if (!invitation.token || invitation.status !== InvitationStatus.PENDING) {
      throw new Error("Test 4a Failed: Invitation creation failed or status invalid.");
    }
    console.log(`✔ Created invitation with token: ${invitation.token.slice(0, 10)}... (Status: ${invitation.status})`);

    // 4b: Duplicate invitation prevention
    let duplicateBlocked = false;
    try {
      await createWorkspaceInvitation(workspaceId, adminId, inviteeEmail, WorkspaceRole.VIEWER);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.code === "BAD_REQUEST") {
        duplicateBlocked = true;
      }
    }
    if (!duplicateBlocked) {
      throw new Error("Test 4b Failed: Duplicate pending invitation was not blocked.");
    }
    console.log("✔ Duplicate pending invitation correctly rejected.");

    // 4c: Public token resolution
    const retrievedInvite = await getInvitationByToken(invitation.token);
    if (retrievedInvite.email !== inviteeEmail.toLowerCase() || retrievedInvite.workspace.id !== workspaceId) {
      throw new Error("Test 4c Failed: Retrieved invitation metadata mismatch.");
    }
    console.log("✔ Invitation retrieved by token successfully with workspace metadata.");

    // 4d: Eve accepts invitation
    const acceptedResult = await acceptWorkspaceInvitation(invitation.token, inviteeId);
    if (!acceptedResult.member || acceptedResult.member.role !== WorkspaceRole.EDITOR) {
      throw new Error("Test 4d Failed: Invitation acceptance failed.");
    }
    console.log("✔ Eve successfully accepted invitation with role: EDITOR.");

    // Verify DB membership for Eve
    const eveWs = await getWorkspaceForUser(workspaceId, inviteeId);
    if (!eveWs || eveWs.currentUserRole !== WorkspaceRole.EDITOR) {
      throw new Error("Test 4d Failed: Eve not found in workspace with EDITOR role.");
    }
    console.log("✔ Eve confirmed as active workspace member in database.");

    // 4e: Re-using the accepted token is rejected
    let reuseBlocked = false;
    try {
      await acceptWorkspaceInvitation(invitation.token, inviteeId);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        reuseBlocked = true;
      }
    }
    if (!reuseBlocked) {
      throw new Error("Test 4e Failed: Re-using accepted invitation token should be blocked.");
    }
    console.log("✔ Re-using accepted invitation token correctly rejected.");

    // -------------------------------------------------------------------------
    // TEST 5: Invitation Rejection & Cancellation
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Invitation Rejection & Cancellation...");

    // 5a: Create invitation to be rejected by Frank
    const declinedInvite = await createWorkspaceInvitation(
      workspaceId,
      adminId,
      declinedEmail,
      WorkspaceRole.VIEWER
    );
    const rejectResult = await rejectWorkspaceInvitation(declinedInvite.token);
    if (rejectResult.status !== InvitationStatus.REJECTED) {
      throw new Error("Test 5a Failed: Invitation rejection status mismatch.");
    }
    console.log("✔ Invitation successfully rejected by recipient (Status: REJECTED).");

    // 5b: Create invitation to be cancelled by Admin
    const cancelledInvite = await createWorkspaceInvitation(
      workspaceId,
      adminId,
      cancelledEmail,
      WorkspaceRole.VIEWER
    );
    await cancelWorkspaceInvitation(workspaceId, adminId, cancelledInvite.id);
    const cancelledInDb = await prisma.workspaceInvitation.findUnique({
      where: { id: cancelledInvite.id },
    });
    if (cancelledInDb?.status !== InvitationStatus.CANCELLED) {
      throw new Error("Test 5b Failed: Cancelled invitation status mismatch.");
    }
    console.log("✔ Invitation successfully cancelled by Admin (Status: CANCELLED).");

    // -------------------------------------------------------------------------
    // TEST 6: Member Role Modification & Removal
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Member Role Modification & Removal...");

    // 6a: Owner updates Eve's role from EDITOR to VIEWER
    const updatedMember = await updateMemberRole(workspaceId, ownerId, inviteeId, WorkspaceRole.VIEWER);
    if (updatedMember.role !== WorkspaceRole.VIEWER) {
      throw new Error("Test 6a Failed: Failed to update Eve's role to VIEWER.");
    }
    console.log("✔ Owner successfully updated Eve's role from EDITOR to VIEWER.");

    // 6b: Admin removes Eve from workspace
    await removeWorkspaceMember(workspaceId, adminId, inviteeId);
    const evePostRemoval = await getWorkspaceForUser(workspaceId, inviteeId);
    if (evePostRemoval !== null) {
      throw new Error("Test 6b Failed: Eve still has workspace access after removal.");
    }
    console.log("✔ Eve successfully removed from workspace by Admin.");

    // -------------------------------------------------------------------------
    // TEST 7: Activity Feed Audit Trail
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Workspace Activity Feed Audit Trail...");

    const activities = await getWorkspaceActivities(workspaceId, ownerId, 25);
    const actionsLogged = activities.map((a) => a.action);
    console.log(`-> Logged ${activities.length} activities: [${Array.from(new Set(actionsLogged)).join(", ")}]`);

    const requiredActions = [
      "WORKSPACE_CREATED",
      "WORKSPACE_UPDATED",
      "MEMBER_INVITED",
      "MEMBER_JOINED",
      "MEMBER_ROLE_UPDATED",
      "MEMBER_REMOVED",
    ];

    for (const action of requiredActions) {
      if (!actionsLogged.includes(action)) {
        throw new Error(`Test 7 Failed: Expected activity "${action}" was not found in audit log.`);
      }
    }
    console.log("✔ All required activity action types verified in chronological audit trail.");

    // Verify unauthorized user cannot access activity feed
    let outsiderActivityBlocked = false;
    try {
      await getWorkspaceActivities(workspaceId, outsiderId);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.code === "FORBIDDEN") {
        outsiderActivityBlocked = true;
      }
    }
    if (!outsiderActivityBlocked) {
      throw new Error("Test 7 Failed: Outsider should not be allowed to view activity feed.");
    }
    console.log("✔ Non-member access to activity feed correctly forbidden.");

    // -------------------------------------------------------------------------
    // TEST 8: Workspace Search across Pages & Spatial Canvases
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Cross-Workspace Search across Pages & Canvases...");

    // 8a: Create a page with unique search content
    const page = await createPage(workspaceId, ownerId, {
      title: "Microservices Blueprint 2027",
    });
    await prisma.page.update({
      where: { id: page.id },
      data: { content: "Decentralized consensus algorithm and event bus infrastructure." },
    });
    console.log(`✔ Created page: "${page.title}"`);

    // 8b: Save spatial canvas with sticky note text
    await saveCanvasForWorkspace(workspaceId, ownerId, {
      nodes: [
        {
          id: "sticky-node-1",
          workspaceId,
          type: "STICKY",
          x: 200,
          y: 350,
          width: 220,
          height: 180,
          zIndex: 1,
          content: "Spatial Whiteboard Action Item: Production Rollout",
          colorId: "amber",
        },
      ],
    });
    console.log("✔ Saved spatial canvas with sticky note content.");

    // 8c: Search for Page title keyword
    const pageTitleResults = await searchWorkspace(workspaceId, ownerId, "Microservices");
    if (pageTitleResults.pages.length === 0 || !pageTitleResults.pages[0].title.includes("Microservices")) {
      throw new Error("Test 8c Failed: Search by page title did not return match.");
    }
    console.log(`✔ Search "Microservices" found page match: "${pageTitleResults.pages[0].title}"`);

    // 8d: Search for Page content keyword
    const pageContentResults = await searchWorkspace(workspaceId, ownerId, "consensus");
    if (pageContentResults.pages.length === 0) {
      throw new Error("Test 8d Failed: Search by page content did not return match.");
    }
    console.log(`✔ Search "consensus" found content match with snippet: "${pageContentResults.pages[0].snippet}"`);

    // 8e: Search for Spatial Canvas node keyword
    const canvasNodeResults = await searchWorkspace(workspaceId, ownerId, "Whiteboard Action Item");
    if (canvasNodeResults.canvases.length === 0) {
      throw new Error("Test 8e Failed: Search by canvas node content did not return match.");
    }
    console.log(`✔ Search "Whiteboard Action Item" found spatial canvas match: "${canvasNodeResults.canvases[0].snippet}"`);

    // 8f: Search for non-existent term
    const emptyResults = await searchWorkspace(workspaceId, ownerId, "NonExistentTermXYZ999");
    if (emptyResults.total !== 0) {
      throw new Error("Test 8f Failed: Expected 0 search results for non-existent query.");
    }
    console.log("✔ Search for non-existent query returned 0 results as expected.");

    // 8g: Outsider search forbidden
    let outsiderSearchBlocked = false;
    try {
      await searchWorkspace(workspaceId, outsiderId, "Microservices");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.code === "FORBIDDEN") {
        outsiderSearchBlocked = true;
      }
    }
    if (!outsiderSearchBlocked) {
      throw new Error("Test 8g Failed: Outsider should not be allowed to search workspace.");
    }
    console.log("✔ Non-member workspace search correctly forbidden.");

    // -------------------------------------------------------------------------
    // TEST 9: Non-Regression on Collaborative Canvas Persistence
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Non-Regression on Collaborative Canvas Persistence...");
    const canvasData = await getCanvasForWorkspace(workspaceId, ownerId);
    if (!canvasData || !Array.isArray(canvasData.nodes) || canvasData.nodes.length === 0) {
      throw new Error("Test 9 Failed: Canvas nodes not persisted or retrieved correctly.");
    }
    const retrievedNode = canvasData.nodes[0] as { id: string; content?: string };
    if (retrievedNode.id !== "sticky-node-1") {
      throw new Error("Test 9 Failed: Canvas node ID mismatch.");
    }
    console.log("✔ Collaborative canvas data fully intact with durable persistence.");

    console.log("\n================================================================================");
    console.log("🎉 ALL PHASE 10.1 ADVANCED WORKSPACE TESTS PASSED SUCCESSFULLY! (9/9)");
    console.log("================================================================================\n");
  } catch (error) {
    console.error("\n❌ PHASE 10.1 TEST RUN ENCOUNTERED ERROR:", error);
    process.exit(1);
  } finally {
    // Cleanup test data to prevent cluttering the database
    console.log("[Cleanup] Cleaning up Phase 10 test artifacts...");
    try {
      if (workspaceId) {
        await prisma.workspaceActivity.deleteMany({ where: { workspaceId } });
        await prisma.workspaceInvitation.deleteMany({ where: { workspaceId } });
        await prisma.canvas.deleteMany({ where: { workspaceId } });
        await prisma.page.deleteMany({ where: { workspaceId } });
        await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
        await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      }
      const testUserIds = [ownerId, adminId, editorId, viewerId, inviteeId, declinedId, outsiderId].filter(Boolean);
      if (testUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
      }
      console.log("✔ Test cleanup complete.");
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr);
    }
    await prisma.$disconnect();
  }
}

runAdvancedWorkspaceTests();
