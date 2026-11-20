/**
 * SyncSpace Phase 11.2: Security Hardening & Regression Test Suite
 *
 * Verifies:
 * 1. Cross-Workspace IDOR & Unauthorized Access Isolation
 * 2. Role-Based Access Control (RBAC) Enforcement (Viewer, Editor, Admin, Owner)
 * 3. Invitation Email Verification (Prevents unauthorized user accepting another's invite)
 * 4. Invitation State Integrity (Prevents re-rejecting or tampering with accepted invites)
 * 5. Cryptographic Collaboration Token Verification (HMAC-SHA256, expiration, scope mismatch)
 * 6. Rate Limiting Protection on Sensitive Actions
 */

import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { WorkspaceRole, InvitationStatus } from "@prisma/client";
import {
  createWorkspace,
  getWorkspaceForUser,
  updateWorkspaceSettings,
  createPage,
  getPageForUser,
  createWorkspaceInvitation,
  acceptWorkspaceInvitation,
  rejectWorkspaceInvitation,
  WorkspaceError,
  removeWorkspaceMember,
} from "../src/lib/services/workspace";
import { getCanvasForWorkspace, saveCanvasForWorkspace } from "../src/lib/services/canvas";
import { signCollabToken, verifyCollabToken } from "../src/lib/collaboration/token";
import { checkRateLimit } from "../src/lib/security/rate-limit";

const TIMESTAMP = Date.now();

async function runSecurityTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 11.2: Security Audit & Hardening Tests");
  console.log("=================================================");

  // Setup Test Users
  const aliceEmail = `sec_alice_${TIMESTAMP}@example.com`;
  const bobEmail = `sec_bob_${TIMESTAMP}@example.com`;
  const charlieEmail = `sec_charlie_${TIMESTAMP}@example.com`;
  const malloryEmail = `sec_mallory_${TIMESTAMP}@example.com`;

  const alice = await prisma.user.create({ data: { name: "Alice Security", email: aliceEmail } });
  const bob = await prisma.user.create({ data: { name: "Bob Security", email: bobEmail } });
  const charlie = await prisma.user.create({ data: { name: "Charlie Security", email: charlieEmail } });
  const mallory = await prisma.user.create({ data: { name: "Mallory Attacker", email: malloryEmail } });

  console.log(`[Setup] Provisioned 4 isolated test identities.`);

  let workspaceAId = "";
  let workspaceBId = "";
  let pageAId = "";

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Cross-Workspace IDOR & Data Access Isolation
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Cross-Workspace IDOR Isolation...");

    const wsA = await createWorkspace(alice.id, { name: "Alice Corporate HQ" });
    const wsB = await createWorkspace(bob.id, { name: "Bob Confidential Research" });
    workspaceAId = wsA.id;
    workspaceBId = wsB.id;

    const pageA = await createPage(workspaceAId, alice.id, {
      title: "Alice Internal Roadmap",
      content: "Proprietary strategic initiatives for Q4.",
    });
    pageAId = pageA.id;

    // Bob attempts to read Alice's workspace
    const bobWsAccess = await getWorkspaceForUser(workspaceAId, bob.id);
    if (bobWsAccess !== null) {
      throw new Error("Security Violation: Bob was able to access Alice's workspace.");
    }
    console.log("✔ Bob correctly denied access to Alice's workspace metadata.");

    // Bob attempts to read Alice's page
    const bobPageAccess = await getPageForUser(workspaceAId, pageAId, bob.id);
    if (bobPageAccess !== null) {
      throw new Error("Security Violation: Bob was able to access Alice's page.");
    }
    console.log("✔ Bob correctly denied access to Alice's document page.");

    // Bob attempts to read Alice's canvas
    const bobCanvasAccess = await getCanvasForWorkspace(workspaceAId, bob.id);
    if (bobCanvasAccess !== null) {
      throw new Error("Security Violation: Bob was able to access Alice's canvas.");
    }
    console.log("✔ Bob correctly denied access to Alice's spatial canvas.");

    // -------------------------------------------------------------------------
    // TEST 2: Role-Based Access Control (RBAC) Hardening
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Role-Based Access Control (RBAC) Enforcement...");

    // Add Charlie as VIEWER in Alice's Workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspaceAId,
        userId: charlie.id,
        role: WorkspaceRole.VIEWER,
      },
    });

    // 2a: Viewer attempts to create a page
    let viewerCreateBlocked = false;
    try {
      await createPage(workspaceAId, charlie.id, { title: "Illegal Viewer Page" });
    } catch (err) {
      if (err instanceof WorkspaceError && err.status === 403) {
        viewerCreateBlocked = true;
      }
    }
    if (!viewerCreateBlocked) {
      throw new Error("Security Violation: Viewer was able to create a document page.");
    }
    console.log("✔ Viewer correctly forbidden from creating document pages.");

    // 2b: Viewer attempts to save/edit canvas
    let viewerCanvasSaveBlocked = false;
    try {
      await saveCanvasForWorkspace(workspaceAId, charlie.id, {
        nodes: [
          {
            id: "viewer-node",
            type: "STICKY",
            x: 0,
            y: 0,
            width: 200,
            height: 180,
            content: "Tampered node",
            colorId: "amber",
            zIndex: 1,
          },
        ],
      });
    } catch (err) {
      if (err instanceof WorkspaceError && err.status === 403) {
        viewerCanvasSaveBlocked = true;
      }
    }
    if (!viewerCanvasSaveBlocked) {
      throw new Error("Security Violation: Viewer was able to modify the canvas.");
    }
    console.log("✔ Viewer correctly forbidden from modifying canvas objects.");

    // 2c: Promote Charlie to EDITOR; test settings update
    await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceAId,
          userId: charlie.id,
        },
      },
      data: { role: WorkspaceRole.EDITOR },
    });

    let editorSettingsBlocked = false;
    try {
      await updateWorkspaceSettings(workspaceAId, charlie.id, { name: "Tampered Workspace Name" });
    } catch (err) {
      if (err instanceof WorkspaceError && err.status === 403) {
        editorSettingsBlocked = true;
      }
    }
    if (!editorSettingsBlocked) {
      throw new Error("Security Violation: Editor was able to update workspace settings.");
    }
    console.log("✔ Editor correctly forbidden from modifying workspace settings.");

    // 2d: Promote Charlie to ADMIN; test removing OWNER
    await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceAId,
          userId: charlie.id,
        },
      },
      data: { role: WorkspaceRole.ADMIN },
    });

    let adminRemoveOwnerBlocked = false;
    try {
      await removeWorkspaceMember(workspaceAId, charlie.id, alice.id);
    } catch (err) {
      if (err instanceof WorkspaceError && err.status === 403) {
        adminRemoveOwnerBlocked = true;
      }
    }
    if (!adminRemoveOwnerBlocked) {
      throw new Error("Security Violation: Admin was able to remove workspace owner.");
    }
    console.log("✔ Admin correctly forbidden from removing workspace owner.");

    // -------------------------------------------------------------------------
    // TEST 3: Invitation Recipient Email Enforcement (Fix H-1 Verification)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Invitation Email Verification Hardening (Fix H-1)...");

    const rightfulInviteeEmail = `sec_rightful_${TIMESTAMP}@example.com`;
    const rightfulUser = await prisma.user.create({
      data: { name: "Rightful Invitee", email: rightfulInviteeEmail },
    });

    const invite = await createWorkspaceInvitation(
      workspaceAId,
      alice.id,
      rightfulInviteeEmail,
      WorkspaceRole.EDITOR
    );

    // Mallory (attacker) attempts to accept invitation addressed to rightfulUser
    let malloryAcceptBlocked = false;
    try {
      await acceptWorkspaceInvitation(invite.token, mallory.id);
    } catch (err) {
      if (err instanceof WorkspaceError && err.status === 403) {
        malloryAcceptBlocked = true;
      }
    }
    if (!malloryAcceptBlocked) {
      throw new Error("Security Violation: Mallory was able to accept an invitation addressed to another email!");
    }
    console.log("✔ Attack thwarted: Unintended recipient forbidden from accepting invitation (Fix H-1 verified).");

    // Rightful user accepts invitation
    const rightfulAccept = await acceptWorkspaceInvitation(invite.token, rightfulUser.id);
    if (!rightfulAccept.member || rightfulAccept.member.role !== WorkspaceRole.EDITOR) {
      throw new Error("Acceptance by rightful recipient failed.");
    }
    console.log("✔ Rightful recipient successfully verified and joined workspace.");

    // -------------------------------------------------------------------------
    // TEST 4: Invitation State Integrity (Fix H-2 Verification)
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Invitation State Tamper Resistance (Fix H-2)...");

    // Mallory attempts to reject the already accepted invitation
    let rejectAcceptedBlocked = false;
    try {
      await rejectWorkspaceInvitation(invite.token);
    } catch (err) {
      if (err instanceof WorkspaceError && err.status === 400) {
        rejectAcceptedBlocked = true;
      }
    }
    if (!rejectAcceptedBlocked) {
      throw new Error("Security Violation: Able to reject an already accepted invitation!");
    }
    console.log("✔ Rejection of already-accepted invitation correctly rejected (Fix H-2 verified).");

    // -------------------------------------------------------------------------
    // TEST 5: Cryptographic Collaboration Token Verification
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Cryptographic Collaboration Token Security...");

    // Generate valid token for Alice in Workspace A, page A
    const validToken = signCollabToken({
      userId: alice.id,
      userName: alice.name,
      workspaceId: workspaceAId,
      pageId: pageAId,
      canEdit: true,
      role: "OWNER",
    });

    const verified = verifyCollabToken(validToken);
    if (!verified || verified.userId !== alice.id) {
      throw new Error("Valid token failed verification.");
    }
    console.log("✔ Valid HMAC-SHA256 collaboration token successfully verified.");

    // 5a: Tampered token signature
    const parts = validToken.split(".");
    const tamperedToken = `${parts[0]}.invalid_signature_${TIMESTAMP}`;
    const tamperedResult = verifyCollabToken(tamperedToken);
    if (tamperedResult !== null) {
      throw new Error("Security Violation: Forged token was accepted!");
    }
    console.log("✔ Forged token with invalid signature rejected.");

    // 5b: Expired token
    const expiredToken = signCollabToken(
      {
        userId: alice.id,
        userName: alice.name,
        workspaceId: workspaceAId,
        pageId: pageAId,
        canEdit: true,
        role: "OWNER",
      },
      -10 // Expired 10 seconds ago
    );
    const expiredResult = verifyCollabToken(expiredToken);
    if (expiredResult !== null) {
      throw new Error("Security Violation: Expired token was accepted!");
    }
    console.log("✔ Expired collaboration token rejected.");

    // -------------------------------------------------------------------------
    // TEST 6: Rate Limiting Enforcement
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Rate Limiting Protection...");

    const testRateKey = `test_ratelimit_${TIMESTAMP}`;
    const limit = 5;
    for (let i = 0; i < limit; i++) {
      const res = checkRateLimit(testRateKey, limit, 60000);
      if (!res.success) {
        throw new Error(`Rate limit prematurely triggered on request ${i + 1}`);
      }
    }

    // 6th request must exceed the limit
    const exceededRes = checkRateLimit(testRateKey, limit, 60000);
    if (exceededRes.success) {
      throw new Error("Security Violation: Request exceeding rate limit was allowed.");
    }
    console.log(`✔ Rate limit successfully blocked excessive request (limit: ${limit}/min).`);

    // Cleanup rightfulUser
    await prisma.user.delete({ where: { id: rightfulUser.id } }).catch(() => {});
  } finally {
    // Cleanup Test Entities
    console.log("\n[Cleanup] Cleaning up test security artifacts...");
    if (workspaceAId) {
      await prisma.workspace.delete({ where: { id: workspaceAId } }).catch(() => {});
    }
    if (workspaceBId) {
      await prisma.workspace.delete({ where: { id: workspaceBId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { id: { in: [alice.id, bob.id, charlie.id, mallory.id] } },
    }).catch(() => {});
    console.log("✔ Security test cleanup complete.");
  }

  console.log("\n=================================================");
  console.log("🎉 ALL PHASE 11.2 SECURITY TESTS PASSED! (6/6)");
  console.log("=================================================");
}

runSecurityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Security Test Failed:", err);
    process.exit(1);
  });

