export type UserRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface User {
  id: string;
  name: string | null;
  email: string;
  passwordHash?: string | null;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  bio?: string;
  role?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  notifications: boolean;
  compactMode: boolean;
  defaultWorkspaceId?: string;
}

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}
