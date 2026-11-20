import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getVersionsForPage,
  createVersionSnapshot,
} from "@/lib/services/versions";
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
    const versions = await getVersionsForPage(workspaceId, pageId, session.user.id);
    return NextResponse.json({ versions });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch versions.";
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
    const body = await req.json().catch(() => ({}));
    const description = typeof body?.description === "string" ? body.description : undefined;

    const version = await createVersionSnapshot(
      workspaceId,
      pageId,
      session.user.id,
      description
    );

    return NextResponse.json({ success: true, version }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create version.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
