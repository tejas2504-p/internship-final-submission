"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Trash2,
  Check,
  AlertCircle,
  Copy,
  Clock,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkspaceDetailData, WorkspaceInvitation, WorkspaceRole } from "@/types/workspace";

interface WorkspaceSettingsViewProps {
  workspace: WorkspaceDetailData;
  currentUserId: string;
  onWorkspaceUpdated?: (updated: Partial<WorkspaceDetailData>) => void;
}

const EMOJI_OPTIONS = ["🚀", "📁", "🎨", "💡", "⚡", "🏢", "🎯", "🛠️", "💻", "📊", "📝", "🌟", "🔥", "🔮"];

export function WorkspaceSettingsView({
  workspace,
  currentUserId,
  onWorkspaceUpdated,
}: WorkspaceSettingsViewProps) {
  const router = useRouter();

  // Settings form state
  const [name, setName] = React.useState(workspace.name);
  const [description, setDescription] = React.useState(workspace.description || "");
  const [icon, setIcon] = React.useState(workspace.icon || "📁");
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = React.useState<string | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<WorkspaceRole>("MEMBER");
  const [isInviting, setIsInviting] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = React.useState<string | null>(null);

  // Pending invitations state
  const [invitations, setInvitations] = React.useState<WorkspaceInvitation[]>([]);
  const [copiedToken, setCopiedToken] = React.useState<string | null>(null);

  // Member role update state
  const [updatingMemberId, setUpdatingMemberId] = React.useState<string | null>(null);
  const [memberActionError, setMemberActionError] = React.useState<string | null>(null);
  const [memberActionSuccess, setMemberActionSuccess] = React.useState<string | null>(null);

  // Delete workspace state
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const canManage = workspace.canManageSettings;
  const isOwner = workspace.currentUserRole === "OWNER";

  // Fetch pending invitations
  const fetchInvitations = React.useCallback(async () => {
    if (!workspace.canManageMembers) return;
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/invitations`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch invitations:", err);
    }
  }, [workspace.id, workspace.canManageMembers]);

  React.useEffect(() => {
    let isCancelled = false;
    if (!workspace.canManageMembers) return;

    fetch(`/api/workspaces/${workspace.id}/invitations`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data?.invitations) {
          setInvitations(data.invitations);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch invitations:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [workspace.id, workspace.canManageMembers]);

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);
    setIsSavingSettings(true);

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          icon,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update workspace settings");
      }

      setSettingsSuccess("Workspace settings updated successfully.");
      onWorkspaceUpdated?.({
        name: data.workspace.name,
        description: data.workspace.description,
        icon: data.workspace.icon,
      });
      router.refresh();
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Invite Member
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setIsInviting(true);

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}.`);
      setInviteEmail("");
      fetchInvitations();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Cancel Invitation
  const handleCancelInvite = async (invitationId: string) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspace.id}/invitations/${invitationId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        fetchInvitations();
      }
    } catch (err: unknown) {
      console.error("Failed to cancel invitation:", err);
    }
  };

  // Copy invitation link
  const handleCopyInviteLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/invitations/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // Handle Role Change
  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    setMemberActionError(null);
    setMemberActionSuccess(null);
    setUpdatingMemberId(memberId);

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update member role");
      }

      setMemberActionSuccess("Member role updated.");
      router.refresh();
    } catch (err: unknown) {
      setMemberActionError(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // Handle Member Removal
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) {
      return;
    }

    setMemberActionError(null);
    setMemberActionSuccess(null);

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      setMemberActionSuccess(`Member ${memberName} removed.`);
      router.refresh();
    } catch (err: unknown) {
      setMemberActionError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  // Handle Delete Workspace
  const handleDeleteWorkspace = async () => {
    if (deleteConfirm !== workspace.name) {
      setDeleteError(`Please type "${workspace.name}" exactly to confirm deletion.`);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete workspace");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete workspace");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* 1. WORKSPACE SETTINGS SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
              {icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Workspace General Settings</h3>
              <p className="text-xs text-slate-500">
                Update the workspace name, description, and visual icon
              </p>
            </div>
          </div>
          <Badge variant="outline" size="sm" className="font-mono text-xs">
            Role: {workspace.currentUserRole}
          </Badge>
        </div>

        <form onSubmit={handleSaveSettings} className="p-5 sm:p-6 space-y-5">
          {settingsError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{settingsError}</span>
            </div>
          )}

          {settingsSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{settingsSuccess}</span>
            </div>
          )}

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Workspace Icon
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 rounded-xl text-base flex items-center justify-center transition-all focus-ring ${
                    icon === emoji
                      ? "bg-indigo-100 border-2 border-indigo-600 shadow-xs scale-105"
                      : "bg-slate-50 hover:bg-slate-100 border border-slate-200/80"
                  } ${!canManage ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Workspace Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Workspace Name
            </label>
            <input
              type="text"
              required
              disabled={!canManage}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Engineering Workspace"
              className="w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400 mt-1">2 to 50 characters.</p>
          </div>

          {/* Workspace Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              disabled={!canManage}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the projects, team mission, and collaborative scope of this workspace..."
              className="w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">Maximum 500 characters.</p>
          </div>

          {canManage && (
            <div className="pt-2">
              <Button type="submit" variant="primary" size="sm" isLoading={isSavingSettings}>
                <Check className="w-4 h-4 mr-1.5" />
                <span>Save Changes</span>
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* 2. ROLE-BASED ACCESS CONTROL MATRIX */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-slate-900">Role-Based Access Control (RBAC)</h3>
        </div>
        <p className="text-xs text-slate-500">
          SyncSpace enforces four distinct permission tiers to ensure secure multi-user collaboration:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-purple-900 tracking-wide">OWNER</span>
              <Badge variant="brand" size="sm">Primary</Badge>
            </div>
            <p className="text-[12px] text-purple-800 leading-snug">
              Complete administrative control. Delete workspace, transfer ownership, manage settings, invite and remove all members.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-900 tracking-wide">ADMIN</span>
              <Badge variant="warning" size="sm">Management</Badge>
            </div>
            <p className="text-[12px] text-indigo-800 leading-snug">
              Manage workspace settings, invite team members, adjust Editor and Viewer roles, remove non-admin members.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-sky-900 tracking-wide">EDITOR (MEMBER)</span>
              <Badge variant="outline" size="sm">Collaborative</Badge>
            </div>
            <p className="text-[12px] text-sky-800 leading-snug">
              Create and edit workspace pages, modify spatial canvas nodes, leave comments, and participate in real-time edits.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 tracking-wide">VIEWER</span>
              <Badge variant="outline" size="sm">Read Only</Badge>
            </div>
            <p className="text-[12px] text-slate-700 leading-snug">
              Read-only view of workspace pages and spatial whiteboard. Cannot modify content or add objects.
            </p>
          </div>
        </div>
      </div>

      {/* 3. INVITATIONS & MEMBER MANAGEMENT */}
      {workspace.canManageMembers && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-6">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Invite New Members</h3>
          </div>

          {inviteError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {inviteSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{inviteSuccess}</span>
            </div>
          )}

          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="email"
              required
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full flex-1 px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400 shadow-2xs"
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="w-full sm:w-44 px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
            >
              <option value="MEMBER">Editor (MEMBER)</option>
              {isOwner && <option value="ADMIN">Administrator</option>}
              <option value="VIEWER">Viewer (Read only)</option>
            </select>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isInviting}
              className="w-full sm:w-auto shrink-0 py-2.5"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              <span>Send Invite</span>
            </Button>
          </form>

          {/* Pending Invitations Table */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Pending Invitations ({invitations.length})
            </h4>

            {invitations.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No pending invitations.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{inv.email}</div>
                      <div className="text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                        <span className="font-medium text-indigo-600">Role: {inv.role}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(inv.token)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs focus-ring"
                      >
                        {copiedToken === inv.token ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancelInvite(inv.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus-ring"
                        title="Cancel invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ACTIVE MEMBERS & ROLE MANAGEMENT */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Workspace Members ({workspace.members.length})
            </h3>
          </div>
        </div>

        {memberActionError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{memberActionError}</span>
          </div>
        )}

        {memberActionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{memberActionSuccess}</span>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {workspace.members.map((member) => {
            const initials = member.user.name
              ? member.user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "U";

            const isSelf = member.userId === currentUserId;
            const canChangeRole =
              isOwner && member.role !== "OWNER" && !isSelf;
            const canRemove =
              (isOwner && member.role !== "OWNER") ||
              (workspace.currentUserRole === "ADMIN" && member.role !== "OWNER" && member.role !== "ADMIN") ||
              (isSelf && member.role !== "OWNER");

            return (
              <div
                key={member.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/50 transition-colors text-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span>{member.user.name}</span>
                      {isSelf && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{member.user.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  {/* Role Selector or Badge */}
                  {canChangeRole ? (
                    <select
                      value={member.role}
                      disabled={updatingMemberId === member.id}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as WorkspaceRole)}
                      className="px-2.5 py-1 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">EDITOR (MEMBER)</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  ) : (
                    <Badge variant={member.role === "OWNER" ? "brand" : member.role === "ADMIN" ? "warning" : "outline"} size="sm">
                      {member.role}
                    </Badge>
                  )}

                  {/* Remove Button */}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id, member.user.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus-ring"
                      title={isSelf ? "Leave workspace" : "Remove member"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. DANGER ZONE (OWNER ONLY) */}
      {isOwner && (
        <div className="bg-rose-50/50 rounded-2xl border border-rose-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-rose-700">
            <Trash2 className="w-5 h-5 shrink-0" />
            <h3 className="text-base font-bold">Danger Zone</h3>
          </div>
          <p className="text-xs text-rose-800">
            Deleting this workspace is permanent. All pages, spatial canvases, comments, and member associations will be erased immediately.
          </p>

          {deleteError && (
            <div className="p-3 rounded-xl bg-white border border-rose-300 text-rose-700 text-xs">
              {deleteError}
            </div>
          )}

          <div className="space-y-3 pt-1">
            <label className="block text-xs font-semibold text-slate-700">
              Type <span className="font-mono text-rose-700 font-bold">{workspace.name}</span> to confirm:
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={workspace.name}
                className="w-full sm:w-80 px-3.5 py-2 text-sm text-slate-900 bg-white border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-400"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isDeleting}
                disabled={deleteConfirm !== workspace.name}
                onClick={handleDeleteWorkspace}
                className="w-full sm:w-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-300"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                <span>Delete Workspace Permanently</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

