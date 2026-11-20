import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getCanvasForWorkspace,
  saveCanvasForWorkspace,
  CanvasConflictError,
} from "@/lib/services/canvas";
import { WorkspaceError } from "@/lib/services/workspace";

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
    const canvas = await getCanvasForWorkspace(workspaceId, session.user.id);
    if (!canvas) {
      return NextResponse.json(
        { error: "Workspace canvas not found or access denied." },
        { status: 404 }
      );
    }
    return NextResponse.json({ canvas });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch canvas";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const canvas = await saveCanvasForWorkspace(workspaceId, session.user.id, body);
    return NextResponse.json({ canvas, message: "Canvas saved successfully" });
  } catch (error: unknown) {
    if (error instanceof CanvasConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          conflict: true,
          currentVersion: error.currentVersion,
          canvas: error.canvasData,
        },
        { status: 409 }
      );
    }
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to save canvas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

