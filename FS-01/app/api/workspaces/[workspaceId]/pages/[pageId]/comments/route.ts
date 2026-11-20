import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getCommentsForPage,
  addCommentToPage,
} from "@/lib/services/comments";
import { WorkspaceError } from "@/lib/services/workspace";

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
    const comments = await getCommentsForPage(workspaceId, pageId, session.user.id);
    return NextResponse.json({ comments });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch comments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, pageId } = await params;

  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const comment = await addCommentToPage(
      workspaceId,
      pageId,
      session.user.id,
      body.content
    );

    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to add comment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
