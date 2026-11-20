"use client";

import * as React from "react";
import type { Awareness } from "y-protocols/awareness";
import type { CollabColor } from "@/src/lib/collaboration/color";

export interface PresenceUser {
  userId: string;
  userName: string;
  role: string;
  canEdit: boolean;
  color: CollabColor;
  isCurrentUser: boolean;
  clientCount: number;
}

interface CollaboratorPresenceProps {
  awareness: Awareness | null;
  currentUserId: string;
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getPresenceUsers(
  awareness: Awareness | null,
  currentUserId: string
): PresenceUser[] {
  if (!awareness) return [];
  const states = awareness.getStates();
  const userMap = new Map<string, PresenceUser>();

  states.forEach((state) => {
    if (!state || !state.user || typeof state.user !== "object") return;
    const u = state.user as {
      userId?: string;
      userName?: string;
      role?: string;
      canEdit?: boolean;
      color?: CollabColor;
    };

    if (!u.userId) return;

    const existing = userMap.get(u.userId);
    if (existing) {
      existing.clientCount += 1;
    } else {
      userMap.set(u.userId, {
        userId: u.userId,
        userName: u.userName || "Anonymous",
        role: u.role || "MEMBER",
        canEdit: u.canEdit ?? true,
        color: u.color || {
          name: "Indigo",
          hex: "#6366f1",
          bg: "#e0e7ff",
          text: "#ffffff",
        },
        isCurrentUser: u.userId === currentUserId,
        clientCount: 1,
      });
    }
  });

  return Array.from(userMap.values()).sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return a.userName.localeCompare(b.userName);
  });
}

export function CollaboratorPresence({
  awareness,
  currentUserId,
}: CollaboratorPresenceProps) {
  const [users, setUsers] = React.useState<PresenceUser[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!awareness) return;

    const updatePresence = () => {
      setUsers(getPresenceUsers(awareness, currentUserId));
    };

    awareness.on("change", updatePresence);
    const timer = setTimeout(updatePresence, 0);

    return () => {
      clearTimeout(timer);
      awareness.off("change", updatePresence);
    };
  }, [awareness, currentUserId]);

  const activeUsers = awareness ? users : [];

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  if (!awareness || activeUsers.length === 0) {
    return null;
  }

  const otherUsers = activeUsers.filter((u) => !u.isCurrentUser);
  const maxVisibleAvatars = 4;
  const visibleUsers = activeUsers.slice(0, maxVisibleAvatars);
  const overflowCount = activeUsers.length - maxVisibleAvatars;

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setShowDropdown((prev) => !prev)}
        aria-label={`View online collaborators (${activeUsers.length} active)`}
        className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        {/* Overlapping Avatar Stack */}
        <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
          {visibleUsers.map((user) => (
            <div
              key={user.userId}
              title={`${user.userName}${user.isCurrentUser ? " (You)" : ""} - ${
                user.role
              }`}
              style={{
                backgroundColor: user.color.hex,
                borderColor: "#ffffff",
              }}
              className="relative inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white shadow-2xs border-2 transition-transform hover:scale-110 hover:z-10 select-none"
            >
              {getInitials(user.userName)}
              {user.isCurrentUser && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
              )}
            </div>
          ))}

          {overflowCount > 0 && (
            <div className="relative inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold text-slate-600 bg-slate-200 border-2 border-white shadow-2xs select-none">
              +{overflowCount}
            </div>
          )}
        </div>

        {/* Presence Summary Label */}
        {otherUsers.length === 0 ? (
          <span className="hidden md:inline text-xs text-slate-500 font-medium pr-1 select-none">
            Only you
          </span>
        ) : (
          <span className="hidden md:inline text-xs text-slate-600 font-medium pr-1 select-none">
            {activeUsers.length} online
          </span>
        )}
      </button>

      {/* Collaborator Dropdown / Popover */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-white p-3 shadow-lg border border-slate-200 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-900">
              Active in this page
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeUsers.length} {activeUsers.length === 1 ? "person" : "people"}
            </span>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {activeUsers.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    style={{ backgroundColor: user.color.hex }}
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                  >
                    {getInitials(user.userName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {user.userName}
                      {user.isCurrentUser && (
                        <span className="ml-1 text-[10px] font-normal text-slate-500">
                          (You)
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: user.color.hex }}
                      />
                      <span>
                        {user.canEdit ? "Can edit" : "View only"}
                      </span>
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    user.role === "OWNER"
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : user.role === "MEMBER"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {user.role}
                </span>
              </div>
            ))}
          </div>

          {otherUsers.length === 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-500">
                Invite workspace members to collaborate in real-time.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
