import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getWorkspaceForUser,
  updateWorkspaceSettings,
  deleteWorkspace,
  WorkspaceError,
} from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    const workspace = await getWorkspaceForUser(workspaceId, session.user.id);
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found or access denied." },
        { status: 404 }
      );
    }
    return NextResponse.json({ workspace });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch workspace";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    const body = await req.json();
    const workspace = await updateWorkspaceSettings(workspaceId, session.user.id, {
      name: body.name,
      description: body.description,
      icon: body.icon,
    });
    return NextResponse.json({ workspace });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to update workspace settings";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await deleteWorkspace(workspaceId, session.user.id);
    return NextResponse.json({ success: true, message: "Workspace deleted" });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to delete workspace";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
