import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getCanvasForWorkspace } from "@/lib/services/canvas";
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
    const canvas = await getCanvasForWorkspace(workspaceId, session.user.id);
    if (!canvas) {
      return NextResponse.json(
        { error: "Canvas not found or access denied." },
        { status: 404 }
      );
    }

    const userName = session.user.name || "Anonymous";
    const userColor = getCollabColor(session.user.id);
    const canEdit = canvas.canEdit ?? false;
    const role = canvas.currentUserRole ?? "VIEWER";

    const token = signCollabToken({
      userId: session.user.id,
      userName,
      workspaceId,
      pageId: "canvas",
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

    const roomName = `${workspaceId}:canvas`;

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
      error instanceof Error ? error.message : "Failed to generate canvas collaboration token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

