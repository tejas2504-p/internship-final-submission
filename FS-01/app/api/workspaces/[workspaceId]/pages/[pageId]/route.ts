import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getPageForUser,
  updatePage,
  deletePage,
  WorkspaceError,
} from "@/lib/services/workspace";

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
    return NextResponse.json({ page });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch page";
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

  const { workspaceId, pageId } = await params;

  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    if (body.title !== undefined && typeof body.title !== "string") {
      return NextResponse.json({ error: "Page title must be a string." }, { status: 400 });
    }
    if (body.content !== undefined && body.content !== null && typeof body.content !== "string") {
      return NextResponse.json({ error: "Page content must be a string." }, { status: 400 });
    }

    const page = await updatePage(workspaceId, pageId, session.user.id, {
      title: body.title,
      content: body.content,
    });
    return NextResponse.json({ success: true, page });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to update page";
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

  const { workspaceId, pageId } = await params;

  try {
    await deletePage(workspaceId, pageId, session.user.id);
    return NextResponse.json({ success: true, message: "Page deleted" });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to delete page";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
