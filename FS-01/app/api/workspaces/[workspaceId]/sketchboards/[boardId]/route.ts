import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getSketchboardById,
  saveSketchboardForWorkspace,
  deleteSketchboard,
  SketchboardConflictError,
} from "@/lib/services/sketchboard";
import { WorkspaceError } from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    boardId: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { boardId } = await params;

  try {
    const sketchboard = await getSketchboardById(boardId, session.user.id);
    if (!sketchboard) {
      return NextResponse.json(
        { error: "Sketchboard not found or access denied." },
        { status: 404 }
      );
    }
    return NextResponse.json({ sketchboard });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch sketchboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, boardId } = await params;

  try {
    const body = await req.json();
    const sketchboard = await saveSketchboardForWorkspace(
      workspaceId,
      session.user.id,
      body,
      boardId
    );
    return NextResponse.json({ sketchboard, message: "Sketchboard saved successfully" });
  } catch (error: unknown) {
    if (error instanceof SketchboardConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          conflict: true,
          currentVersion: error.currentVersion,
          sketchboard: error.sketchboardData,
        },
        { status: 409 }
      );
    }
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to save sketchboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { boardId } = await params;

  try {
    await deleteSketchboard(boardId, session.user.id);
    return NextResponse.json({ success: true, message: "Sketchboard deleted successfully" });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to delete sketchboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

