import { Extension } from "@tiptap/core";
import { yCursorPlugin } from "@tiptap/y-tiptap";
import type { Awareness } from "y-protocols/awareness";

export interface CollabCursorUser {
  name?: string;
  userName?: string;
  userId?: string;
  role?: string;
  color?: string | { hex: string; name: string };
  [key: string]: unknown;
}

export interface CollaborationCaretOptions {
  awareness: Awareness | null;
  cursorBuilder?: (user: CollabCursorUser) => HTMLElement;
}

/**
 * Default custom cursor builder for SyncSpace.
 * Renders an accessible, unobtrusive colored caret with a modern user name badge.
 */
export function createSyncSpaceCursor(user: CollabCursorUser): HTMLElement {
  const cursor = document.createElement("span");
  cursor.classList.add("ProseMirror-yjs-cursor");

  const colorHex =
    typeof user.color === "object" && user.color !== null
      ? user.color.hex
      : typeof user.color === "string"
      ? user.color
      : "#6366f1";

  cursor.setAttribute("style", `border-color: ${colorHex};`);

  const displayName = user.userName || user.name || "Collaborator";
  const roleBadge = user.role ? ` (${user.role.toLowerCase()})` : "";

  const label = document.createElement("div");
  label.setAttribute("style", `background-color: ${colorHex};`);
  label.setAttribute("aria-label", `${displayName}${roleBadge}`);
  label.appendChild(document.createTextNode(`${displayName}${roleBadge}`));

  // Zero-width spaces protect against ProseMirror inline boundary cursor-sticking
  const space1 = document.createTextNode("\u2060");
  const space2 = document.createTextNode("\u2060");

  cursor.appendChild(space1);
  cursor.appendChild(label);
  cursor.appendChild(space2);

  return cursor;
}

/**
 * Default selection decoration builder.
 * Generates an unobtrusive, readable background tint with a subtle bottom underline.
 */
export function createSyncSpaceSelection(user: CollabCursorUser) {
  const colorHex =
    typeof user.color === "object" && user.color !== null
      ? user.color.hex
      : typeof user.color === "string"
      ? user.color
      : "#6366f1";

  return {
    style: `background-color: ${colorHex}25; border-bottom: 2px solid ${colorHex}70;`,
    class: "ProseMirror-yjs-selection",
  };
}

/**
 * Tiptap extension integrating Yjs awareness carets and live selections.
 * Seamlessly hooks into the existing Yjs WebSocket provider and document lifecycle.
 */
export const CollaborationCaret = Extension.create<CollaborationCaretOptions>({
  name: "collaborationCaret",

  addOptions() {
    return {
      awareness: null,
      cursorBuilder: createSyncSpaceCursor,
    };
  },

  addProseMirrorPlugins() {
    if (!this.options.awareness) {
      return [];
    }

    return [
      yCursorPlugin(this.options.awareness, {
        cursorBuilder: this.options.cursorBuilder || createSyncSpaceCursor,
        selectionBuilder: createSyncSpaceSelection,
      }),
    ];
  },
});
