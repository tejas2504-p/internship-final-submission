import { SessionUser } from "@/types";

/**
 * Authentication architecture foundation for SyncSpace.
 * Full integration with provider (NextAuth / Lucia / Supabase Auth) scheduled for Phase 2.
 */

export interface AuthSession {
  user: SessionUser | null;
  status: "authenticated" | "unauthenticated" | "loading";
}

/**
 * Helper to determine user permission level within a workspace.
 */
export function hasPermission(
  userRole: string,
  requiredRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
): boolean {
  const roleWeights: Record<string, number> = {
    OWNER: 4,
    ADMIN: 3,
    MEMBER: 2,
    VIEWER: 1,
  };

  const userWeight = roleWeights[userRole] ?? 0;
  const targetWeight = roleWeights[requiredRole] ?? 0;

  return userWeight >= targetWeight;
}
