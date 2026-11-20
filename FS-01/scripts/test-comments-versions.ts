import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import {
  createWorkspace,
  addWorkspaceMember,
  createPage,
  WorkspaceError,
} from "../src/lib/services/workspace";
import {
  getCommentsForPage,
  addCommentToPage,
  deleteCommentFromPage,
  validateCommentContent,
} from "../src/lib/services/comments";
import {
  getVersionsForPage,
  createVersionSnapshot,
  restoreVersion,
} from "../src/lib/services/versions";
import { WorkspaceRole } from "@prisma/client";

async function runCommentsAndVersionsTests() {
  console.log("=================================================");
  console.log("SyncSpace Phase 6B: Comments & Version History Test Suite");
  console.log("=================================================\n");

  const ts = Date.now();
  const aliceEmail = `alice-cv-${ts}@test.syncspace.dev`;
  const bobEmail = `bob-cv-${ts}@test.syncspace.dev`;
  const viewerEmail = `viewer-cv-${ts}@test.syncspace.dev`;
  const intruderEmail = `intruder-cv-${ts}@test.syncspace.dev`;

  let aliceId = "";
  let bobId = "";
  let viewerId = "";
  let intruderId = "";
  let workspaceId = "";
  let pageId = "";

  try {
    // ----------------------------------------------------
    // SETUP
    // ----------------------------------------------------
    console.log("[Setup] Creating test users and workspace...");
    const alice = await prisma.user.create({
      data: { name: "Alice Owner", email: aliceEmail, emailVerified: true },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: { name: "Bob Member", email: bobEmail, emailVerified: true },
    });
    bobId = bob.id;

    const viewer = await prisma.user.create({
      data: { name: "Victor Viewer", email: viewerEmail, emailVerified: true },
    });
    viewerId = viewer.id;

    const intruder = await prisma.user.create({
      data: { name: "Eve Intruder", email: intruderEmail, emailVerified: true },
    });
    intruderId = intruder.id;

    const workspace = await createWorkspace(aliceId, {
      name: `Collab Space ${ts}`,
    });
    workspaceId = workspace.id;

    // Add Bob as MEMBER
    await addWorkspaceMember(workspaceId, aliceId, bobEmail, WorkspaceRole.MEMBER);

    // Add Victor as VIEWER
    await addWorkspaceMember(workspaceId, aliceId, viewerEmail, WorkspaceRole.VIEWER);

    // Create Page
    const page = await createPage(workspaceId, aliceId, {
      title: "Architecture Guide",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Initial architecture draft." }],
          },
        ],
      }),
    });
    pageId = page.id;
    console.log(`[Setup] Workspace=${workspaceId}, Page=${pageId} created successfully.\n`);

    // ----------------------------------------------------
    // SECTION 1: COMMENTS TESTS
    // ----------------------------------------------------
    console.log("--- SECTION 1: Comments Functionality & Authorization ---");

    // Test 1.1: Bob (MEMBER) adds a comment
    console.log("[Test 1.1] Bob (MEMBER) adds a comment...");
    const bobComment = await addCommentToPage(
      workspaceId,
      pageId,
      bobId,
      "Looks great! We should consider adding caching."
    );
    if (!bobComment.id || bobComment.content !== "Looks great! We should consider adding caching.") {
      throw new Error("Test 1.1 Failed: Comment was not created correctly.");
    }
    if (bobComment.authorId !== bobId || bobComment.author.name !== "Bob Member") {
      throw new Error("Test 1.1 Failed: Comment author metadata mismatch.");
    }
    console.log("✓ Test 1.1 Passed: Bob added comment with correct author and timestamp.");

    // Test 1.2: Alice (OWNER) adds a comment
    console.log("[Test 1.2] Alice (OWNER) adds a reply comment...");
    const aliceComment = await addCommentToPage(
      workspaceId,
      pageId,
      aliceId,
      "Agreed, caching will be added in Phase 7."
    );
    if (!aliceComment.id) {
      throw new Error("Test 1.2 Failed: Alice could not post comment.");
    }
    console.log("✓ Test 1.2 Passed: Alice posted comment successfully.");

    // Test 1.3: View comments lists both comments in chronological order
    console.log("[Test 1.3] Bob retrieves page comments list...");
    const commentsList = await getCommentsForPage(workspaceId, pageId, bobId);
    if (commentsList.length !== 2) {
      throw new Error(`Test 1.3 Failed: Expected 2 comments, found ${commentsList.length}`);
    }
    if (commentsList[0].id !== bobComment.id || commentsList[1].id !== aliceComment.id) {
      throw new Error("Test 1.3 Failed: Comments not ordered chronologically.");
    }
    console.log("✓ Test 1.3 Passed: Comments retrieved in chronological order.");

    // Test 1.4: Validation - Empty comment rejection
    console.log("[Test 1.4] Validation: Empty comment rejection...");
    try {
      await addCommentToPage(workspaceId, pageId, bobId, "   ");
      throw new Error("Test 1.4 Failed: Empty comment was accepted.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 400) {
        console.log("✓ Test 1.4 Passed: Empty comment rejected with 400 Bad Request.");
      } else {
        throw err;
      }
    }

    // Test 1.5: Validation - Excessively long comment rejection
    console.log("[Test 1.5] Validation: Excessively long comment rejection (>2000 chars)...");
    try {
      const longText = "a".repeat(2001);
      await addCommentToPage(workspaceId, pageId, bobId, longText);
      throw new Error("Test 1.5 Failed: Excessively long comment was accepted.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 400) {
        console.log("✓ Test 1.5 Passed: >2000 chars comment rejected with 400 Bad Request.");
      } else {
        throw err;
      }
    }

    // Test 1.6: Security - Viewer cannot add comments
    console.log("[Test 1.6] Security: Victor (VIEWER) cannot post comments...");
    try {
      await addCommentToPage(workspaceId, pageId, viewerId, "Viewer commenting test");
      throw new Error("Test 1.6 Failed: Viewer was able to post comment.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        console.log("✓ Test 1.6 Passed: Viewer comment rejected with 403 Forbidden.");
      } else {
        throw err;
      }
    }

    // Test 1.7: Security - Intruder (non-member) cannot view or post comments
    console.log("[Test 1.7] Security: Eve (non-member) cannot access or post comments...");
    try {
      await addCommentToPage(workspaceId, pageId, intruderId, "Intruder comment");
      throw new Error("Test 1.7 Failed: Non-member was able to post comment.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        console.log("✓ Test 1.7 Passed: Non-member post rejected with 403 Forbidden.");
      } else {
        throw err;
      }
    }

    try {
      await getCommentsForPage(workspaceId, pageId, intruderId);
      throw new Error("Test 1.7 Failed: Non-member was able to view comments.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        console.log("✓ Test 1.7 Passed: Non-member view comments rejected with 403 Forbidden.");
      } else {
        throw err;
      }
    }

    // Test 1.8: Security - Bob CANNOT delete Alice's comment
    console.log("[Test 1.8] Security: Bob cannot delete Alice's comment...");
    try {
      await deleteCommentFromPage(workspaceId, pageId, aliceComment.id, bobId);
      throw new Error("Test 1.8 Failed: Bob was able to delete Alice's comment.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        console.log("✓ Test 1.8 Passed: Unauthorized comment deletion rejected with 403.");
      } else {
        throw err;
      }
    }

    // Test 1.9: Authorized Deletion - Bob deletes his OWN comment
    console.log("[Test 1.9] Authorized Deletion: Bob deletes his own comment...");
    await deleteCommentFromPage(workspaceId, pageId, bobComment.id, bobId);
    const afterBobDelete = await getCommentsForPage(workspaceId, pageId, bobId);
    if (afterBobDelete.some((c) => c.id === bobComment.id)) {
      throw new Error("Test 1.9 Failed: Bob's comment still exists after deletion.");
    }
    console.log("✓ Test 1.9 Passed: Author successfully deleted own comment.");

    // Test 1.10: Authorized Admin Deletion - Alice (OWNER) deletes a comment
    console.log("[Test 1.10] Authorized Admin Deletion: Alice (OWNER) deletes comment...");
    await deleteCommentFromPage(workspaceId, pageId, aliceComment.id, aliceId);
    const afterAliceDelete = await getCommentsForPage(workspaceId, pageId, aliceId);
    if (afterAliceDelete.length !== 0) {
      throw new Error("Test 1.10 Failed: Comments remain after owner deletion.");
    }
    console.log("✓ Test 1.10 Passed: Owner successfully deleted comment.\n");

    // ----------------------------------------------------
    // SECTION 2: VERSION HISTORY TESTS
    // ----------------------------------------------------
    console.log("--- SECTION 2: Version History & Safe Restoration ---");

    // Test 2.1: Create deliberate version checkpoint (Version 1)
    console.log("[Test 2.1] Alice creates Version 1 checkpoint...");
    const v1 = await createVersionSnapshot(
      workspaceId,
      pageId,
      aliceId,
      "Initial Draft V1"
    );
    if (!v1.id || v1.description !== "Initial Draft V1") {
      throw new Error("Test 2.1 Failed: Version 1 snapshot creation failed.");
    }
    if (v1.createdById !== aliceId || v1.creator.name !== "Alice Owner") {
      throw new Error("Test 2.1 Failed: Creator metadata mismatch.");
    }
    console.log(`✓ Test 2.1 Passed: Version 1 created (id=${v1.id}).`);

    // Test 2.2: Update page content to state 2
    console.log("[Test 2.2] Updating page content to state 2...");
    await prisma.page.update({
      where: { id: pageId },
      data: {
        title: "Architecture Guide - Revised",
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Revised content with database schema." }],
            },
          ],
        }),
      },
    });

    // Bob creates Version 2 checkpoint
    console.log("[Test 2.2] Bob creates Version 2 checkpoint...");
    const v2 = await createVersionSnapshot(
      workspaceId,
      pageId,
      bobId,
      "Revised with Database Schema V2"
    );
    if (!v2.id || v2.title !== "Architecture Guide - Revised") {
      throw new Error("Test 2.2 Failed: Version 2 snapshot failed.");
    }
    console.log(`✓ Test 2.2 Passed: Version 2 created (id=${v2.id}).`);

    // Test 2.3: Retrieve version history list
    console.log("[Test 2.3] Retrieve versions list...");
    const versionList = await getVersionsForPage(workspaceId, pageId, aliceId);
    if (versionList.length !== 2) {
      throw new Error(`Test 2.3 Failed: Expected 2 versions, found ${versionList.length}`);
    }
    // Most recent version first
    if (versionList[0].id !== v2.id || versionList[1].id !== v1.id) {
      throw new Error("Test 2.3 Failed: Versions not ordered descending by timestamp.");
    }
    console.log("✓ Test 2.3 Passed: Versions retrieved with author and timestamps in order.");

    // Test 2.4: Update page to state 3 (a bad edit we want to revert)
    console.log("[Test 2.4] Simulating accidental bad edit on live page...");
    await prisma.page.update({
      where: { id: pageId },
      data: {
        title: "Accidentally Corrupted Title",
        content: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Oops, deleted section!" }] }],
        }),
      },
    });

    // Test 2.5: Restore Version 1
    console.log("[Test 2.5] Bob restores Version 1 ('Initial Draft V1')...");
    const restoreResult = await restoreVersion(
      workspaceId,
      pageId,
      v1.id,
      bobId
    );

    // Verify restored page content and title
    if (restoreResult.page.title !== "Architecture Guide") {
      throw new Error(
        `Test 2.5 Failed: Restored page title expected 'Architecture Guide', got '${restoreResult.page.title}'`
      );
    }
    if (!restoreResult.page.content?.includes("Initial architecture draft.")) {
      throw new Error("Test 2.5 Failed: Restored content does not match V1.");
    }

    // Verify that restoration creates a NEW version rather than deleting historical records!
    const versionsAfterRestore = await getVersionsForPage(workspaceId, pageId, aliceId);
    console.log(`[Test 2.5] Total versions after restore: ${versionsAfterRestore.length}`);
    if (versionsAfterRestore.length !== 3) {
      throw new Error(
        `Test 2.5 Failed: Expected 3 versions after restore, found ${versionsAfterRestore.length}. Historical records must not be deleted!`
      );
    }

    // Verify V1 and V2 are still intact in history
    const hasV1 = versionsAfterRestore.some((v) => v.id === v1.id);
    const hasV2 = versionsAfterRestore.some((v) => v.id === v2.id);
    const hasRestoredNew = versionsAfterRestore.some((v) => v.id === restoreResult.newVersion.id);

    if (!hasV1 || !hasV2 || !hasRestoredNew) {
      throw new Error("Test 2.5 Failed: Historical versions missing after restoration.");
    }
    console.log("✓ Test 2.5 Passed: Restored Version 1 successfully; created new current version and preserved all historical records.");

    // Test 2.6: Security - Victor (VIEWER) cannot create or restore versions
    console.log("[Test 2.6] Security: Victor (VIEWER) cannot create or restore versions...");
    try {
      await createVersionSnapshot(workspaceId, pageId, viewerId, "Viewer checkpoint");
      throw new Error("Test 2.6 Failed: Viewer was able to create version snapshot.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        console.log("✓ Test 2.6 Passed: Viewer checkpoint rejected with 403 Forbidden.");
      } else {
        throw err;
      }
    }

    try {
      await restoreVersion(workspaceId, pageId, v1.id, viewerId);
      throw new Error("Test 2.6 Failed: Viewer was able to restore version.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        console.log("✓ Test 2.6 Passed: Viewer restore rejected with 403 Forbidden.");
      } else {
        throw err;
      }
    }

    // Test 2.7: Security - Eve (non-member) cannot access versions
    console.log("[Test 2.7] Security: Eve (non-member) cannot access versions...");
    try {
      await getVersionsForPage(workspaceId, pageId, intruderId);
      throw new Error("Test 2.7 Failed: Non-member was able to get versions.");
    } catch (err: unknown) {
      if (err instanceof WorkspaceError && err.status === 403) {
        console.log("✓ Test 2.7 Passed: Non-member versions access rejected with 403 Forbidden.");
      } else {
        throw err;
      }
    }

    console.log("\n=================================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! (10/10)");
    console.log("=================================================");
  } finally {
    // Cleanup test data
    console.log("\n[Cleanup] Cleaning up test records from database...");
    if (workspaceId) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    }
    const userIds = [aliceId, bobId, viewerId, intruderId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    console.log("[Cleanup] Completed cleanly.");
  }
}

runCommentsAndVersionsTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Test Suite Failed:", err);
    process.exit(1);
  });
