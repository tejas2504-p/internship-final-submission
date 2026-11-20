import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getSketchboardForWorkspace,
  saveSketchboardForWorkspace,
  SketchboardConflictError,
} from "@/lib/services/sketchboard";
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
    const sketchboard = await getSketchboardForWorkspace(workspaceId, session.user.id);
    if (!sketchboard) {
      return NextResponse.json(
        { error: "Workspace sketchboard not found or access denied." },
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

  const { workspaceId } = await params;

  try {
    const body = await req.json();
    const sketchboard = await saveSketchboardForWorkspace(workspaceId, session.user.id, body);
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

