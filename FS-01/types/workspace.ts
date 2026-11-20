export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "MEMBER" | "VIEWER";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  slug?: string;
  membersCount?: number;
  documentsCount?: number;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  createdAt: Date;
  joinedAt?: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  inviter?: {
    id: string;
    name: string;
    email: string;
  };
  workspace?: {
    id: string;
    name: string;
    icon?: string | null;
  };
}

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  actor?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface Page {
  id: string;
  title: string;
  content: string | null;
  workspaceId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  content: string;
  pageId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersion {
  id: string;
  pageId: string;
  content: string;
  createdById: string;
  createdAt: Date;
}

export interface WorkspaceSearchResultItem {
  id: string;
  type: "page" | "canvas";
  title: string;
  snippet?: string;
  url: string;
  updatedAt: string | Date;
}

export interface WorkspaceSearchResults {
  query: string;
  total: number;
  pages: WorkspaceSearchResultItem[];
  canvases: WorkspaceSearchResultItem[];
}

export interface WorkspaceDetailData {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  ownerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  owner: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  currentUserRole: WorkspaceRole;
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canCreatePage: boolean;
  members: Array<{
    id: string;
    userId: string;
    workspaceId: string;
    role: WorkspaceRole;
    createdAt: Date | string;
    user: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  }>;
  pages: Array<{
    id: string;
    title: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    createdById: string;
    creator: {
      id: string;
      name: string;
    };
  }>;
  canvas?: {
    id: string;
    name: string;
    description?: string | null;
    updatedAt: Date | string;
  } | null;
  sketchboards?: Array<{
    id: string;
    name: string;
    description?: string | null;
    updatedAt: Date | string;
    createdById?: string | null;
  }>;
}

// Retain Document and CanvasNode for landing page interactive components
export type DocumentType = "DOCUMENT" | "CANVAS" | "HYBRID";

export interface Document {
  id: string;
  workspaceId: string;
  title: string;
  content: string | null;
  type?: DocumentType;
  icon?: string | null;
  coverImage?: string | null;
  isArchived?: boolean;
  isPublished?: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export type { CanvasNodeType, CanvasNode } from "./canvas";
