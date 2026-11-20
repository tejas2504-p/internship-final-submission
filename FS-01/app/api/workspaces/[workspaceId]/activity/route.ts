import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getWorkspaceActivities,
  WorkspaceError,
} from "@/lib/services/workspace";

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
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam && /^\d+$/.test(limitParam) ? parseInt(limitParam, 10) : 50;

  try {
    const activities = await getWorkspaceActivities(workspaceId, session.user.id, limit);
    return NextResponse.json({ activities });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch activities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

