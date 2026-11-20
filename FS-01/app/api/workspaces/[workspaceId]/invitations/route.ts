import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import {
  createWorkspaceInvitation,
  getWorkspaceInvitations,
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

  try {
    const invitations = await getWorkspaceInvitations(workspaceId, session.user.id);
    return NextResponse.json({ invitations });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch invitations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  const rateLimit = checkRateLimit(`invite:${session.user.id}`, 15, 60000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many invitation requests. Please wait a minute before sending more." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const invitation = await createWorkspaceInvitation(
      workspaceId,
      session.user.id,
      body.email,
      body.role
    );
    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

