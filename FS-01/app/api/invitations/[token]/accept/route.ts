import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { acceptWorkspaceInvitation, WorkspaceError } from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;

  const rateLimit = checkRateLimit(`invite-accept:${session.user.id}`, 10, 60000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again shortly." },
      { status: 429 }
    );
  }

  try {
    const result = await acceptWorkspaceInvitation(token, session.user.id);
    return NextResponse.json({
      success: true,
      message: "Successfully joined workspace",
      workspaceId: result.workspace.id,
      member: result.member,
    });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to accept invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

