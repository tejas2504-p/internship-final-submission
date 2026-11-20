import { NextRequest, NextResponse } from "next/server";
import { getInvitationByToken, WorkspaceError } from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  try {
    const invitation = await getInvitationByToken(token);
    return NextResponse.json({ invitation });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

