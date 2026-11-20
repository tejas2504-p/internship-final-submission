import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { auth } from "../src/lib/auth";
import { createWorkspace, createPage } from "../src/lib/services/workspace";

async function seed() {
  console.log("Seeding user, workspace, and page for browser test...");

  const testEmail = "demo_user@syncspace.dev";
  const testPassword = "Password123!";
  const testName = "Alex Engineer";

  // Check if user already exists
  let user = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!user) {
    const res = await auth.api.signUpEmail({
      body: {
        name: testName,
        email: testEmail,
        password: testPassword,
      },
    });
    user = res.user as any;
    console.log("Created test user:", user?.email);
  } else {
    console.log("User already exists:", user.email);
  }

  if (!user) {
    throw new Error("Failed to find or create test user");
  }

  // Create or find workspace
  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: user.id, name: "Engineering Lab" },
  });

  if (!workspace) {
    workspace = await createWorkspace(user.id, { name: "Engineering Lab" });
    console.log("Created workspace:", workspace.id);
  } else {
    console.log("Workspace already exists:", workspace.id);
  }

  // Create page with initial structured JSON
  const initialJson = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Phase 4B Architecture Document" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Welcome to " },
          { type: "text", marks: [{ type: "bold" }], text: "SyncSpace" },
          { type: "text", text: ". This document verifies persistence and autosave." },
        ],
      },
    ],
  };

  let page = await prisma.page.findFirst({
    where: { workspaceId: workspace.id, title: "Phase 4B Architecture Document" },
  });

  if (!page) {
    page = await createPage(workspace.id, user.id, {
      title: "Phase 4B Architecture Document",
      content: JSON.stringify(initialJson),
    });
    console.log("Created page:", page.id);
  } else {
    console.log("Page already exists:", page.id);
  }

  console.log("\nSEED COMPLETE!");
  console.log(`URL: http://localhost:3000/workspaces/${workspace.id}/pages/${page.id}`);
  console.log(`User: ${testEmail} / ${testPassword}`);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
