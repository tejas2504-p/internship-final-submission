import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getUserWorkspaces, createWorkspace, WorkspaceError } from "@/lib/services/workspace";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspaces = await getUserWorkspaces(session.user.id);
    return NextResponse.json({ workspaces });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch workspaces";
    console.error("Error fetching workspaces:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const workspace = await createWorkspace(session.user.id, {
      name: body.name,
    });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create workspace";
    console.error("Error creating workspace:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
