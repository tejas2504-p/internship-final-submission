import { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "@/lib/auth-server";
import { getInvitationByToken } from "@/lib/services/workspace";
import { Layers, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvitationAcceptCard } from "@/components/workspace/invitation-accept-card";

interface InvitationPageProps {
  params: Promise<{
    token: string;
  }>;
}

export const instant = false;

export async function generateMetadata({ params }: InvitationPageProps): Promise<Metadata> {
  const { token } = await params;
  try {
    const invite = await getInvitationByToken(token);
    return {
      title: `Join ${invite.workspace.name} | SyncSpace`,
      description: `You have been invited to join ${invite.workspace.name} on SyncSpace.`,
    };
  } catch {
    return {
      title: "Workspace Invitation | SyncSpace",
    };
  }
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;
  const session = await getServerSession();

  let invite;
  let errorMsg = null;

  try {
    invite = await getInvitationByToken(token);
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : "Invitation not found or expired.";
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xl space-y-6 text-center">
        {/* Logo */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-500 p-0.5 shadow-md mx-auto flex items-center justify-center">
          <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
            <Layers className="w-6 h-6 text-indigo-600" />
          </div>
        </div>

        {errorMsg || !invite ? (
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Invalid or Expired Invitation</h1>
            <p className="text-xs text-slate-500">
              {errorMsg || "This workspace invitation is no longer valid or has already been accepted."}
            </p>
            <div className="pt-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : invite.isExpired ? (
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Invitation Expired</h1>
            <p className="text-xs text-slate-500">
              The invitation to join <span className="font-semibold">{invite.workspace.name}</span> expired on{" "}
              {new Date(invite.expiresAt).toLocaleDateString()}. Please request a new invitation from the workspace owner.
            </p>
            <div className="pt-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <InvitationAcceptCard
            token={token}
            invitation={invite}
            currentUser={session?.user ?? null}
          />
        )}
      </div>
    </div>
  );
}

