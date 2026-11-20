"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InvitationAcceptCardProps {
  token: string;
  invitation: {
    id: string;
    email: string;
    role: string;
    workspace: {
      id: string;
      name: string;
      description?: string | null;
      icon?: string | null;
    };
    inviter: {
      name: string;
      email: string;
    };
  };
  currentUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export function InvitationAcceptCard({
  token,
  invitation,
  currentUser,
}: InvitationAcceptCardProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      router.push(`/workspaces/${invitation.workspace.id}`);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to join workspace");
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/invitations/${token}/reject`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline invitation");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to decline invitation");
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-3xl font-bold mb-1">{invitation.workspace.icon || "📁"}</div>
        <h1 className="text-xl font-bold text-slate-900">
          Join {invitation.workspace.name}
        </h1>
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{invitation.inviter.name}</span> has invited you to collaborate in this workspace.
        </p>
      </div>

      {invitation.workspace.description && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 italic">
          &ldquo;{invitation.workspace.description}&rdquo;
        </div>
      )}

      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between text-left">
        <div>
          <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">
            Assigned Role
          </span>
          <span className="text-sm font-bold text-indigo-950">
            {invitation.role === "MEMBER" ? "Editor (MEMBER)" : invitation.role}
          </span>
        </div>
        <Badge variant="brand" size="sm">
          {invitation.role}
        </Badge>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {currentUser ? (
        <div className="space-y-3 pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            isLoading={isAccepting}
            onClick={handleAccept}
          >
            <Check className="w-4 h-4 mr-1.5" />
            <span>Accept and Join Workspace</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-slate-500 hover:text-slate-800"
            isLoading={isRejecting}
            onClick={handleReject}
          >
            <X className="w-4 h-4 mr-1.5" />
            <span>Decline Invitation</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-slate-500">
            You must sign in or create an account to accept this invitation.
          </p>
          <div className="flex items-center gap-3">
            <Link href={`/login?redirect=/invitations/${token}`} className="flex-1">
              <Button variant="primary" size="sm" className="w-full">
                Sign In to Accept
              </Button>
            </Link>
            <Link href={`/register?redirect=/invitations/${token}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

