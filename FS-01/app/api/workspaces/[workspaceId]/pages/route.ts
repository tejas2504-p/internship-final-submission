import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { createPage, WorkspaceError } from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    const body = await req.json();
    const page = await createPage(workspaceId, session.user.id, {
      title: body.title,
    });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create page";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
