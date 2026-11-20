import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getSketchboardForWorkspace } from "@/lib/services/sketchboard";
import { WorkspaceError } from "@/lib/services/workspace";
import { signCollabToken } from "@/src/lib/collaboration/token";
import { getCollabColor } from "@/src/lib/collaboration/color";

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
        { error: "Sketchboard not found or access denied." },
        { status: 404 }
      );
    }

    const userName = session.user.name || "Anonymous";
    const userColor = getCollabColor(session.user.id);
    const canEdit = sketchboard.canEdit ?? false;
    const role = sketchboard.currentUserRole ?? "VIEWER";

    const token = signCollabToken({
      userId: session.user.id,
      userName,
      workspaceId,
      pageId: "sketchboard",
      canEdit,
      role,
    });

    const requestedPort =
      process.env.NODE_ENV !== "production"
        ? req.nextUrl.searchParams.get("collabPort") ||
          req.nextUrl.searchParams.get("port")
        : null;

    let wsUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:1234";
    if (requestedPort && /^\d+$/.test(requestedPort)) {
      try {
        const parsed = new URL(wsUrl);
        parsed.port = requestedPort;
        wsUrl = parsed.toString().replace(/\/$/, "");
      } catch {
        wsUrl = `ws://localhost:${requestedPort}`;
      }
    }

    const roomName = `${workspaceId}:sketchboard`;

    return NextResponse.json({
      success: true,
      token,
      wsUrl,
      roomName,
      canEdit,
      role,
      user: {
        userId: session.user.id,
        userName,
        role,
        canEdit,
        color: userColor,
      },
    });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to generate sketchboard collaboration token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

