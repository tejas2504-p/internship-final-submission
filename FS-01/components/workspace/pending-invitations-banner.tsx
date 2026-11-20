"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Check, X, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PendingInvitationItem {
  id: string;
  token: string;
  role: string;
  createdAt: string | Date;
  workspace: {
    id: string;
    name: string;
    icon?: string | null;
    description?: string | null;
  };
  inviter: {
    name: string;
    email: string;
  };
}

interface PendingInvitationsBannerProps {
  invitations: PendingInvitationItem[];
}

export function PendingInvitationsBanner({
  invitations: initialInvitations,
}: PendingInvitationsBannerProps) {
  const router = useRouter();
  const [invitations, setInvitations] = React.useState(initialInvitations);
  const [processingToken, setProcessingToken] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  if (invitations.length === 0) {
    return null;
  }

  const handleAccept = async (inv: PendingInvitationItem) => {
    setProcessingToken(inv.token);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/invitations/${inv.token}/accept`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      // Navigate to the newly joined workspace
      router.push(`/workspaces/${inv.workspace.id}`);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to join workspace");
      setProcessingToken(null);
    }
  };

  const handleDecline = async (token: string) => {
    setProcessingToken(token);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/invitations/${token}/reject`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline invitation");
      }

      setInvitations((prev) => prev.filter((i) => i.token !== token));
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to decline invitation");
    } finally {
      setProcessingToken(null);
    }
  };

  return (
    <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-indigo-50/90 via-sky-50/50 to-white border-2 border-indigo-200/90 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
              <span>Workspace Invitations</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
                {invitations.length}
              </span>
            </h2>
            <p className="text-xs text-slate-600">
              You have been invited to collaborate in the following workspace{invitations.length > 1 ? "s" : ""}.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-3 pt-1">
        {invitations.map((inv) => {
          const isBusy = processingToken === inv.token;

          return (
            <div
              key={inv.id}
              className="p-4 sm:p-5 rounded-2xl bg-white border border-indigo-100/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl shrink-0">
                  {inv.workspace.icon || "📁"}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-base">
                      {inv.workspace.name}
                    </span>
                    <Badge variant="brand" size="sm">
                      {inv.role === "MEMBER" ? "Editor" : inv.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Invited by <span className="font-semibold text-slate-700">{inv.inviter.name}</span> ({inv.inviter.email})
                  </p>
                  {inv.workspace.description && (
                    <p className="text-xs text-slate-600 italic line-clamp-1 pt-0.5">
                      &ldquo;{inv.workspace.description}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isBusy}
                  onClick={() => handleAccept(inv)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  <span>Accept Invitation</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => handleDecline(inv.token)}
                  className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
                >
                  <X className="w-4 h-4 mr-1" />
                  <span>Decline</span>
                </Button>

                <Link
                  href={`/invitations/${inv.token}`}
                  className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors"
                  title="View full invitation"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
