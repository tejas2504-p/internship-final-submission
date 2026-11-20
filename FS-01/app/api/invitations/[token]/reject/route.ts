import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/src/lib/security/rate-limit";
import { rejectWorkspaceInvitation, WorkspaceError } from "@/lib/services/workspace";

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req.headers);
  const rateLimit = checkRateLimit(`invite-reject:${ip}`, 10, 60000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again shortly." },
      { status: 429 }
    );
  }

  const { token } = await params;

  try {
    const updated = await rejectWorkspaceInvitation(token);
    return NextResponse.json({
      success: true,
      message: "Invitation declined",
      status: updated.status,
    });
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to reject invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

