import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { deleteCommentFromPage } from "@/lib/services/comments";
import { WorkspaceError } from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    pageId: string;
    commentId: string;
  }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, pageId, commentId } = await params;

  try {
    await deleteCommentFromPage(workspaceId, pageId, commentId, session.user.id);
    return NextResponse.json({ success: true, message: "Comment deleted." });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to delete comment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
