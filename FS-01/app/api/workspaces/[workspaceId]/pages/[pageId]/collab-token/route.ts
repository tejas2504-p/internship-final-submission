import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getPageForUser, WorkspaceError } from "@/lib/services/workspace";
import { signCollabToken } from "@/src/lib/collaboration/token";
import { getCollabColor } from "@/src/lib/collaboration/color";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    pageId: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, pageId } = await params;

  try {
    const page = await getPageForUser(workspaceId, pageId, session.user.id);
    if (!page) {
      return NextResponse.json(
        { error: "Page not found or access denied." },
        { status: 404 }
      );
    }

    const userName = session.user.name || "Anonymous";
    const userColor = getCollabColor(session.user.id);

    const token = signCollabToken({
      userId: session.user.id,
      userName,
      workspaceId,
      pageId,
      canEdit: page.canEdit,
      role: page.currentUserRole,
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

    const roomName = `${workspaceId}:${pageId}`;

    return NextResponse.json({
      success: true,
      token,
      wsUrl,
      roomName,
      canEdit: page.canEdit,
      role: page.currentUserRole,
      pageTitle: page.title,
      user: {
        userId: session.user.id,
        userName,
        role: page.currentUserRole,
        canEdit: page.canEdit,
        color: userColor,
      },
    });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to generate collaboration token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
