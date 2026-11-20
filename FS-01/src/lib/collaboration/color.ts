export interface CollabColor {
  name: string;
  hex: string;
  bg: string;
  text: string;
}

export interface CollabUserMeta {
  userId: string;
  userName: string;
  role: string;
  canEdit: boolean;
  color: CollabColor;
}

export const COLLAB_PALETTE: CollabColor[] = [
  { name: "Indigo", hex: "#6366f1", bg: "#e0e7ff", text: "#ffffff" },
  { name: "Emerald", hex: "#10b981", bg: "#d1fae5", text: "#ffffff" },
  { name: "Amber", hex: "#d97706", bg: "#fef3c7", text: "#ffffff" },
  { name: "Rose", hex: "#e11d48", bg: "#ffe4e6", text: "#ffffff" },
  { name: "Sky", hex: "#0284c7", bg: "#e0f2fe", text: "#ffffff" },
  { name: "Purple", hex: "#9333ea", bg: "#f3e8ff", text: "#ffffff" },
  { name: "Teal", hex: "#0d9488", bg: "#ccfbf1", text: "#ffffff" },
  { name: "Orange", hex: "#ea580c", bg: "#ffedd5", text: "#ffffff" },
];

/**
 * Deterministically pick a color from the palette based on a user ID string.
 * Ensures consistent colors for a user across reloads and across peers.
 */
export function getCollabColor(userId: string): CollabColor {
  if (!userId) return COLLAB_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLLAB_PALETTE.length;
  return COLLAB_PALETTE[index];
}
