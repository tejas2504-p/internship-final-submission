import prisma from "@/src/lib/db/prisma";
import { WorkspaceRole, InvitationStatus, type Prisma } from "@prisma/client";
import { WorkspaceSearchResultItem, WorkspaceSearchResults } from "@/types/workspace";

export class WorkspaceError extends Error {
  public code: string;
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "WorkspaceError";
    this.code = status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "BAD_REQUEST";
  }
}

/**
 * Validates workspace name: trimmed, 2-50 characters.
 */
export function validateWorkspaceName(name: string): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 2) {
    throw new WorkspaceError("Workspace name must be at least 2 characters long.", 400);
  }
  if (trimmed.length > 50) {
    throw new WorkspaceError("Workspace name cannot exceed 50 characters.", 400);
  }
  return trimmed;
}

/**
 * Validates workspace description: optional, max 500 characters.
 */
export function validateWorkspaceDescription(desc?: string | null): string | null {
  if (desc === undefined || desc === null) return null;
  const trimmed = desc.trim();
  if (trimmed.length > 500) {
    throw new WorkspaceError("Workspace description cannot exceed 500 characters.", 400);
  }
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates workspace icon: optional, max 50 characters (emoji or icon identifier).
 */
export function validateWorkspaceIcon(icon?: string | null): string | null {
  if (icon === undefined || icon === null) return null;
  const trimmed = icon.trim();
  if (trimmed.length > 50) {
    throw new WorkspaceError("Workspace icon identifier cannot exceed 50 characters.", 400);
  }
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates page title: trimmed, max 120 characters. Defaults to "Untitled".
 */
export function validatePageTitle(title?: string): string {
  if (!title || !title.trim()) {
    return "Untitled";
  }
  const trimmed = title.trim();
  if (trimmed.length > 120) {
    throw new WorkspaceError("Page title cannot exceed 120 characters.", 400);
  }
  return trimmed;
}

/**
 * Normalizes email address.
 */
export function normalizeEmail(email: string): string {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new WorkspaceError("Please provide a valid email address.", 400);
  }
  return trimmed;
}

/**
 * Permission check helpers.
 */
export function isOwner(role?: WorkspaceRole | string): boolean {
  return role === WorkspaceRole.OWNER;
}

export function isAdmin(role?: WorkspaceRole | string): boolean {
  return role === WorkspaceRole.ADMIN;
}

export function canManageSettings(role?: WorkspaceRole | string): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

export function canManageMembers(role?: WorkspaceRole | string): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

export function canEditContent(role?: WorkspaceRole | string): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN || role === WorkspaceRole.EDITOR || role === WorkspaceRole.MEMBER;
}

/**
 * Record an activity in the workspace audit trail.
 */
export async function recordWorkspaceActivity(
  workspaceId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown> | null
) {
  try {
    return await prisma.workspaceActivity.create({
      data: {
        workspaceId,
        actorId,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    console.warn(`[WorkspaceActivity] Non-blocking activity recording error:`, err);
    return null;
  }
}

/**
 * Fetch all workspaces the given user belongs to.
 */
export async function getUserWorkspaces(userId: string) {
  const workspaces = await prisma.workspace.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        where: {
          userId,
        },
        select: {
          role: true,
        },
      },
      _count: {
        select: {
          members: true,
          pages: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return workspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    description: ws.description,
    icon: ws.icon,
    ownerId: ws.ownerId,
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
    owner: ws.owner,
    userRole: ws.members[0]?.role ?? (ws.ownerId === userId ? WorkspaceRole.OWNER : WorkspaceRole.VIEWER),
    membersCount: ws._count.members,
    pagesCount: ws._count.pages,
  }));
}

/**
 * Creates a workspace and registers the authenticated user as OWNER in a transaction.
 */
export async function createWorkspace(
  userId: string,
  input: { name: string; description?: string | null; icon?: string | null }
) {
  const validatedName = validateWorkspaceName(input.name);
  const validatedDesc = validateWorkspaceDescription(input.description);
  const validatedIcon = validateWorkspaceIcon(input.icon);

  return prisma.$transaction(async (tx) => {
    // 1. Create Workspace
    const workspace = await tx.workspace.create({
      data: {
        name: validatedName,
        description: validatedDesc,
        icon: validatedIcon,
        ownerId: userId,
      },
    });

    // 2. Create Owner Membership
    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: WorkspaceRole.OWNER,
      },
    });

    // 3. Record Activity
    await tx.workspaceActivity.create({
      data: {
        workspaceId: workspace.id,
        actorId: userId,
        action: "WORKSPACE_CREATED",
        entityType: "workspace",
        entityId: workspace.id,
        metadata: { name: workspace.name },
      },
    });

    return workspace;
  });
}

/**
 * Retrieves the user's membership and role in a given workspace.
 */
export async function getWorkspaceMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      id: true,
      role: true,
      userId: true,
      workspaceId: true,
    },
  });
}

/**
 * Get workspace details with pages and members.
 * Returns null if the user does not have membership.
 */
export async function getWorkspaceForUser(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      members: {
        some: { userId },
      },
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      canvas: {
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
        },
      },
      sketchboards: {
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
          createdById: true,
        },
      },
      members: {
        select: {
          id: true,
          userId: true,
          workspaceId: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      pages: {
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          members: true,
          pages: true,
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  const currentMember = workspace.members.find((m) => m.userId === userId);
  const userRole = currentMember?.role ?? WorkspaceRole.VIEWER;

  return {
    ...workspace,
    currentUserRole: userRole,
    canEdit: canEditContent(userRole),
    canDelete: userRole === WorkspaceRole.OWNER,
    canManageMembers: canManageMembers(userRole),
    canManageSettings: canManageSettings(userRole),
    canCreatePage: userRole !== WorkspaceRole.VIEWER,
  };
}

/**
 * Update workspace settings (name, description, icon).
 * Restricted to OWNER or ADMIN.
 */
export async function updateWorkspaceSettings(
  workspaceId: string,
  userId: string,
  data: { name?: string; description?: string | null; icon?: string | null }
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  if (!canManageSettings(membership.role)) {
    throw new WorkspaceError("Only workspace owners and administrators can update workspace settings.", 403);
  }

  const updateData: { name?: string; description?: string | null; icon?: string | null } = {};

  if (data.name !== undefined) {
    updateData.name = validateWorkspaceName(data.name);
  }
  if (data.description !== undefined) {
    updateData.description = validateWorkspaceDescription(data.description);
  }
  if (data.icon !== undefined) {
    updateData.icon = validateWorkspaceIcon(data.icon);
  }

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: updateData,
  });

  await recordWorkspaceActivity(workspaceId, userId, "WORKSPACE_UPDATED", "workspace", workspaceId, {
    changes: Object.keys(updateData),
    name: updated.name,
  });

  return updated;
}

/**
 * Rename workspace (only OWNER or ADMIN). Backwards compatible with Phase 3B.
 */
export async function renameWorkspace(workspaceId: string, userId: string, newName: string) {
  return updateWorkspaceSettings(workspaceId, userId, { name: newName });
}

/**
 * Delete workspace (only OWNER).
 */
export async function deleteWorkspace(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new WorkspaceError("Workspace not found.", 404);
  }

  if (workspace.ownerId !== userId) {
    throw new WorkspaceError("Only the workspace owner can delete this workspace.", 403);
  }

  return prisma.workspace.delete({
    where: { id: workspaceId },
  });
}

/**
 * Direct member addition (for test suites and immediate invites).
 */
export async function addWorkspaceMember(
  workspaceId: string,
  actorUserId: string,
  targetEmail: string,
  role: WorkspaceRole = WorkspaceRole.MEMBER
) {
  const actorMembership = await getWorkspaceMembership(workspaceId, actorUserId);
  if (!actorMembership || !canManageMembers(actorMembership.role)) {
    throw new WorkspaceError("Only workspace owners and administrators can invite members.", 403);
  }

  if (role === WorkspaceRole.OWNER) {
    throw new WorkspaceError("Cannot assign OWNER role directly. Workspaces have a single owner.", 400);
  }

  const normalized = normalizeEmail(targetEmail);
  const targetUser = await prisma.user.findUnique({
    where: { email: normalized },
  });

  if (!targetUser) {
    throw new WorkspaceError("No SyncSpace user found with this email. They must create an account first.", 404);
  }

  const existing = await getWorkspaceMembership(workspaceId, targetUser.id);
  if (existing) {
    throw new WorkspaceError("User is already a member of this workspace.", 409);
  }

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId: targetUser.id,
      role,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  await recordWorkspaceActivity(workspaceId, actorUserId, "MEMBER_JOINED", "member", member.id, {
    email: normalized,
    role,
    userId: targetUser.id,
  });

  return member;
}

/**
 * Update a member's role in the workspace.
 * Owner can update any member.
 * Admin can update Editor/Member or Viewer (cannot demote/promote Owner or other Admins).
 */
export async function updateMemberRole(
  workspaceId: string,
  actorUserId: string,
  targetMemberId: string,
  newRole: WorkspaceRole
) {
  const actorMembership = await getWorkspaceMembership(workspaceId, actorUserId);
  if (!actorMembership || !canManageMembers(actorMembership.role)) {
    throw new WorkspaceError("Only owners and administrators can change member roles.", 403);
  }

  if (newRole === WorkspaceRole.OWNER) {
    throw new WorkspaceError("Cannot transfer ownership via role change.", 400);
  }

  const targetMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      OR: [{ id: targetMemberId }, { userId: targetMemberId }],
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!targetMember) {
    throw new WorkspaceError("Member not found in this workspace.", 404);
  }

  if (targetMember.role === WorkspaceRole.OWNER) {
    throw new WorkspaceError("Cannot change the workspace owner's role.", 403);
  }

  // Admin restrictions
  if (actorMembership.role === WorkspaceRole.ADMIN) {
    if (targetMember.role === WorkspaceRole.ADMIN) {
      throw new WorkspaceError("Administrators cannot change another administrator's role.", 403);
    }
    if (newRole === WorkspaceRole.ADMIN) {
      throw new WorkspaceError("Only workspace owners can promote members to Administrator.", 403);
    }
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: targetMember.id },
    data: { role: newRole },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  await recordWorkspaceActivity(workspaceId, actorUserId, "MEMBER_ROLE_UPDATED", "member", targetMemberId, {
    targetEmail: targetMember.user.email,
    targetName: targetMember.user.name,
    oldRole: targetMember.role,
    newRole,
  });

  return updated;
}

/**
 * Remove a member from a workspace.
 */
export async function removeWorkspaceMember(
  workspaceId: string,
  actorUserId: string,
  targetMemberId: string
) {
  const targetMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      OR: [{ id: targetMemberId }, { userId: targetMemberId }],
    },
    include: {
      workspace: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (!targetMember) {
    throw new WorkspaceError("Membership record not found.", 404);
  }

  const isSelf = actorUserId === targetMember.userId;

  // Cannot remove owner from own workspace
  if (targetMember.role === WorkspaceRole.OWNER) {
    throw new WorkspaceError("The workspace owner cannot be removed. Delete the workspace instead.", 403);
  }

  if (!isSelf) {
    const actorMembership = await getWorkspaceMembership(workspaceId, actorUserId);
    if (!actorMembership) {
      throw new WorkspaceError("You do not have access to this workspace.", 403);
    }

    if (!canManageMembers(actorMembership.role)) {
      throw new WorkspaceError("Only owners and administrators can remove members.", 403);
    }

    // Admins cannot remove other Admins
    if (actorMembership.role === WorkspaceRole.ADMIN && targetMember.role === WorkspaceRole.ADMIN) {
      throw new WorkspaceError("Administrators cannot remove other administrators.", 403);
    }
  }

  const deleted = await prisma.workspaceMember.delete({
    where: { id: targetMember.id },
  });

  await recordWorkspaceActivity(workspaceId, actorUserId, "MEMBER_REMOVED", "member", targetMemberId, {
    targetEmail: targetMember.user.email,
    targetName: targetMember.user.name,
    isSelf,
  });

  return deleted;
}

// ============================================================================
// WORKSPACE INVITATIONS (PHASE 10.1)
// ============================================================================

/**
 * Create or re-issue an invitation to join a workspace.
 */
export async function createWorkspaceInvitation(
  workspaceId: string,
  actorUserId: string,
  email: string,
  role: WorkspaceRole = WorkspaceRole.MEMBER
) {
  const actorMembership = await getWorkspaceMembership(workspaceId, actorUserId);
  if (!actorMembership || !canManageMembers(actorMembership.role)) {
    throw new WorkspaceError("Only workspace owners and administrators can invite members.", 403);
  }

  if (role === WorkspaceRole.OWNER) {
    throw new WorkspaceError("Cannot invite as OWNER. Workspaces have a single owner.", 400);
  }

  if (actorMembership.role === WorkspaceRole.ADMIN && role === WorkspaceRole.ADMIN) {
    throw new WorkspaceError("Only workspace owners can invite new administrators.", 403);
  }

  const normalized = normalizeEmail(email);

  // Check if user is already an active member
  const existingUser = await prisma.user.findUnique({
    where: { email: normalized },
    include: {
      workspaceMembers: {
        where: { workspaceId },
      },
    },
  });

  if (existingUser?.workspaceMembers && existingUser.workspaceMembers.length > 0) {
    throw new WorkspaceError("User is already an active member of this workspace.", 409);
  }

  // Check existing pending invitation
  const existingInvite = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email: normalized,
      status: InvitationStatus.PENDING,
    },
  });

  const now = new Date();
  if (existingInvite && existingInvite.expiresAt > now) {
    throw new WorkspaceError("An active invitation has already been sent to this email.", 409);
  }

  // 7-day expiration
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = `${workspaceId.slice(-6)}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

  let invitation;
  if (existingInvite) {
    // Refresh expired/stale invitation
    invitation = await prisma.workspaceInvitation.update({
      where: { id: existingInvite.id },
      data: {
        role,
        token,
        status: InvitationStatus.PENDING,
        inviterId: actorUserId,
        expiresAt,
      },
      include: {
        workspace: { select: { id: true, name: true, icon: true } },
        inviter: { select: { id: true, name: true, email: true } },
      },
    });
  } else {
    invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: normalized,
        role,
        token,
        status: InvitationStatus.PENDING,
        inviterId: actorUserId,
        expiresAt,
      },
      include: {
        workspace: { select: { id: true, name: true, icon: true } },
        inviter: { select: { id: true, name: true, email: true } },
      },
    });
  }

  await recordWorkspaceActivity(workspaceId, actorUserId, "MEMBER_INVITED", "invitation", invitation.id, {
    email: normalized,
    role,
    expiresAt: expiresAt.toISOString(),
  });

  return invitation;
}

/**
 * List pending invitations for a workspace (OWNER or ADMIN).
 */
export async function getWorkspaceInvitations(workspaceId: string, actorUserId: string) {
  const actorMembership = await getWorkspaceMembership(workspaceId, actorUserId);
  if (!actorMembership || !canManageMembers(actorMembership.role)) {
    throw new WorkspaceError("Only workspace owners and administrators can view invitations.", 403);
  }

  const now = new Date();
  // Automatically update any past-due pending invitations to EXPIRED
  await prisma.workspaceInvitation.updateMany({
    where: {
      workspaceId,
      status: InvitationStatus.PENDING,
      expiresAt: { lt: now },
    },
    data: {
      status: InvitationStatus.EXPIRED,
    },
  });

  return prisma.workspaceInvitation.findMany({
    where: {
      workspaceId,
      status: InvitationStatus.PENDING,
    },
    include: {
      inviter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Cancel a pending invitation (OWNER or ADMIN).
 */
export async function cancelWorkspaceInvitation(
  workspaceId: string,
  actorUserId: string,
  invitationId: string
) {
  const actorMembership = await getWorkspaceMembership(workspaceId, actorUserId);
  if (!actorMembership || !canManageMembers(actorMembership.role)) {
    throw new WorkspaceError("Only workspace owners and administrators can cancel invitations.", 403);
  }

  const invite = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invite || invite.workspaceId !== workspaceId) {
    throw new WorkspaceError("Invitation not found.", 404);
  }

  return prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: InvitationStatus.CANCELLED },
  });
}

/**
 * Get public details of an invitation by token.
 */
export async function getInvitationByToken(token: string) {
  const invite = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
        },
      },
      inviter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!invite) {
    throw new WorkspaceError("Invitation not found.", 404);
  }

  const isExpired = invite.expiresAt < new Date();
  if (isExpired && invite.status === InvitationStatus.PENDING) {
    await prisma.workspaceInvitation.update({
      where: { id: invite.id },
      data: { status: InvitationStatus.EXPIRED },
    });
    invite.status = InvitationStatus.EXPIRED;
  }

  return {
    ...invite,
    isExpired: isExpired || invite.status === InvitationStatus.EXPIRED,
  };
}

/**
 * Accept an invitation and join the workspace.
 */
export async function acceptWorkspaceInvitation(token: string, userId: string) {
  const invite = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: true,
    },
  });

  if (!invite) {
    throw new WorkspaceError("Invitation not found.", 404);
  }

  if (invite.status !== InvitationStatus.PENDING || invite.expiresAt < new Date()) {
    if (invite.status === InvitationStatus.PENDING) {
      await prisma.workspaceInvitation.update({
        where: { id: invite.id },
        data: { status: InvitationStatus.EXPIRED },
      });
    }
    throw new WorkspaceError("This invitation has expired or is no longer valid.", 410);
  }

  return prisma.$transaction(async (tx) => {
    // Verify that accepting user exists and their email matches the invitation recipient email
    const acceptingUser = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!acceptingUser) {
      throw new WorkspaceError("User not found.", 404);
    }

    if (acceptingUser.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new WorkspaceError(
        `This invitation was addressed to ${invite.email}. Please sign in with that email address to join this workspace.`,
        403
      );
    }

    // Check if already a member
    const existing = await tx.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId,
        },
      },
    });

    let member;
    if (existing) {
      member = existing;
    } else {
      member = await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role,
        },
      });
    }

    // Mark invitation accepted
    await tx.workspaceInvitation.update({
      where: { id: invite.id },
      data: { status: InvitationStatus.ACCEPTED },
    });

    // Record activity
    await tx.workspaceActivity.create({
      data: {
        workspaceId: invite.workspaceId,
        actorId: userId,
        action: "MEMBER_JOINED",
        entityType: "member",
        entityId: member.id,
        metadata: {
          email: invite.email,
          role: invite.role,
          viaInvitation: true,
        },
      },
    });

    return { member, workspace: invite.workspace };
  });
}

/**
 * Reject an invitation.
 */
export async function rejectWorkspaceInvitation(token: string) {
  const invite = await prisma.workspaceInvitation.findUnique({
    where: { token },
  });

  if (!invite) {
    throw new WorkspaceError("Invitation not found.", 404);
  }

  if (invite.status !== InvitationStatus.PENDING || invite.expiresAt < new Date()) {
    throw new WorkspaceError(
      `Invitation is no longer pending (current status: ${invite.status.toLowerCase()}).`,
      400
    );
  }

  return prisma.workspaceInvitation.update({
    where: { id: invite.id },
    data: { status: InvitationStatus.REJECTED },
  });
}

// ============================================================================
// WORKSPACE ACTIVITY AUDIT LOG (PHASE 10.1)
// ============================================================================

/**
 * Retrieve recent activity feed for a workspace.
 */
export async function getWorkspaceActivities(workspaceId: string, userId: string, limit = 50) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  const safeLimit = Math.min(Math.max(1, limit), 100);

  return prisma.workspaceActivity.findMany({
    where: { workspaceId },
    select: {
      id: true,
      workspaceId: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: safeLimit,
  });
}

// ============================================================================
// SEARCH ACROSS PAGES AND CANVASES (PHASE 10.1)
// ============================================================================

/**
 * Perform case-insensitive search across workspace pages and spatial canvases.
 */
export async function searchWorkspace(
  workspaceId: string,
  userId: string,
  query: string
): Promise<WorkspaceSearchResults> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    return { query: "", total: 0, pages: [], canvases: [] };
  }

  // 1. Search Pages (titles and content)
  const pages = await prisma.page.findMany({
    where: {
      workspaceId,
      OR: [
        { title: { contains: trimmedQuery, mode: "insensitive" } },
        { content: { contains: trimmedQuery, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
    },
    take: 20,
    orderBy: { updatedAt: "desc" },
  });

  const pageResults: WorkspaceSearchResultItem[] = pages.map((p) => {
    let snippet: string | undefined;
    if (p.content) {
      const idx = p.content.toLowerCase().indexOf(trimmedQuery.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(p.content.length, idx + trimmedQuery.length + 60);
        snippet = (start > 0 ? "..." : "") + p.content.slice(start, end).replace(/\n/g, " ") + (end < p.content.length ? "..." : "");
      }
    }
    return {
      id: p.id,
      type: "page",
      title: p.title,
      snippet,
      url: `/workspaces/${workspaceId}/pages/${p.id}`,
      updatedAt: p.updatedAt,
    };
  });

  // 2. Search Canvases (name, description, and JSON nodes content)
  const canvas = await prisma.canvas.findUnique({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      nodes: true,
      updatedAt: true,
    },
  });

  const canvasResults: WorkspaceSearchResultItem[] = [];
  if (canvas) {
    const qLower = trimmedQuery.toLowerCase();
    const nameMatch = canvas.name.toLowerCase().includes(qLower);
    const descMatch = canvas.description?.toLowerCase().includes(qLower);

    let matchingNodeSnippet: string | undefined;
    if (Array.isArray(canvas.nodes)) {
      for (const node of canvas.nodes as Array<Record<string, unknown>>) {
        if (node && typeof node === "object" && typeof node.content === "string") {
          if (node.content.toLowerCase().includes(qLower)) {
            const idx = node.content.toLowerCase().indexOf(qLower);
            const start = Math.max(0, idx - 30);
            const end = Math.min(node.content.length, idx + qLower.length + 40);
            const nodeType = typeof node.type === "string" ? node.type : "node";
            matchingNodeSnippet = `[${nodeType}] ` + node.content.slice(start, end);
            break;
          }
        }
      }
    }

    if (nameMatch || descMatch || matchingNodeSnippet) {
      canvasResults.push({
        id: canvas.id,
        type: "canvas",
        title: canvas.name,
        snippet: matchingNodeSnippet || canvas.description || "Spatial whiteboard and diagrams",
        url: `/workspaces/${workspaceId}/canvas`,
        updatedAt: canvas.updatedAt,
      });
    }
  }

  return {
    query: trimmedQuery,
    total: pageResults.length + canvasResults.length,
    pages: pageResults,
    canvases: canvasResults,
  };
}

// ============================================================================
// PAGE SERVICES WITH AUDIT RECORDING
// ============================================================================

/**
 * Create a page in a workspace (OWNER, ADMIN, EDITOR, or MEMBER).
 */
export async function createPage(
  workspaceId: string,
  userId: string,
  input: { title?: string; content?: string }
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  if (membership.role === WorkspaceRole.VIEWER) {
    throw new WorkspaceError("Viewers have read-only access and cannot create pages.", 403);
  }

  const title = validatePageTitle(input.title);

  const page = await prisma.page.create({
    data: {
      title,
      workspaceId,
      createdById: userId,
      content: input.content ?? "",
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  await recordWorkspaceActivity(workspaceId, userId, "PAGE_CREATED", "page", page.id, {
    title: page.title,
  });

  return page;
}

/**
 * Get a specific page scoped to a workspace and user membership.
 */
export async function getPageForUser(workspaceId: string, pageId: string, userId: string) {
  const page = await prisma.page.findFirst({
    where: {
      id: pageId,
      workspaceId,
      workspace: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
          members: {
            where: { userId },
            select: { role: true },
          },
        },
      },
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  if (!page) {
    return null;
  }

  const role = page.workspace.members[0]?.role ?? WorkspaceRole.VIEWER;

  return {
    id: page.id,
    title: page.title,
    content: page.content,
    workspaceId: page.workspaceId,
    createdById: page.createdById,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    creator: page.creator,
    workspace: {
      id: page.workspace.id,
      name: page.workspace.name,
    },
    currentUserRole: role,
    canEdit: canEditContent(role),
    canDelete:
      role === WorkspaceRole.OWNER ||
      role === WorkspaceRole.ADMIN ||
      page.createdById === userId,
    commentsCount: page._count?.comments ?? 0,
  };
}

/**
 * Update page title or content.
 */
export async function updatePage(
  workspaceId: string,
  pageId: string,
  userId: string,
  data: { title?: string; content?: string }
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }
  if (membership.role === WorkspaceRole.VIEWER) {
    throw new WorkspaceError("Viewers do not have permission to edit pages.", 403);
  }

  // Ensure page belongs to this workspace
  const existing = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
  });

  if (!existing) {
    throw new WorkspaceError("Page not found in this workspace.", 404);
  }

  const updateData: { title?: string; content?: string } = {};
  if (data.title !== undefined) {
    updateData.title = validatePageTitle(data.title);
  }
  if (data.content !== undefined) {
    updateData.content = data.content;
  }

  const updated = await prisma.page.update({
    where: { id: pageId },
    data: updateData,
  });

  if (data.content !== undefined) {
    // Invalidate stale Yjs document snapshot in PostgreSQL so collaboration server loads latest content
    await prisma.yjsDocument.deleteMany({ where: { pageId } }).catch(() => {});
  }

  await recordWorkspaceActivity(workspaceId, userId, "PAGE_UPDATED", "page", pageId, {
    title: updated.title,
  });

  return updated;
}

/**
 * Delete page.
 */
export async function deletePage(workspaceId: string, pageId: string, userId: string) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceError("You do not have access to this workspace.", 403);
  }

  const existing = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
  });

  if (!existing) {
    throw new WorkspaceError("Page not found in this workspace.", 404);
  }

  const isOwnerOrAdmin = membership.role === WorkspaceRole.OWNER || membership.role === WorkspaceRole.ADMIN;
  const isCreator = existing.createdById === userId;

  if (!isOwnerOrAdmin && !isCreator) {
    throw new WorkspaceError("Only owners, admins, or the page creator can delete this page.", 403);
  }

  const deleted = await prisma.page.delete({
    where: { id: pageId },
  });

  await recordWorkspaceActivity(workspaceId, userId, "PAGE_DELETED", "page", pageId, {
    title: existing.title,
  });

  return deleted;
}
