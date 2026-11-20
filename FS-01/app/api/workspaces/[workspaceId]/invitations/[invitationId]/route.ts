import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  cancelWorkspaceInvitation,
  WorkspaceError,
} from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    invitationId: string;
  }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, invitationId } = await params;

  try {
    const cancelled = await cancelWorkspaceInvitation(
      workspaceId,
      session.user.id,
      invitationId
    );
    return NextResponse.json({ success: true, invitation: cancelled });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to cancel invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

