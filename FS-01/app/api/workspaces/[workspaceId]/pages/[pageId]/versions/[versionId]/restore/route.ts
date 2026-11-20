import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { restoreVersion } from "@/lib/services/versions";
import { WorkspaceError } from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    pageId: string;
    versionId: string;
  }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, pageId, versionId } = await params;

  try {
    const result = await restoreVersion(
      workspaceId,
      pageId,
      versionId,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      message: "Version restored successfully.",
      page: result.page,
      newVersion: result.newVersion,
    });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to restore version.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
