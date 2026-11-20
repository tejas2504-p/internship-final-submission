"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { AnyExtension, JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { CollaborationCaret } from "./collaboration-cursor";
import { EditorToolbar } from "./editor-toolbar";

/**
 * Safely parse initial document content.
 * Accepts:
 * - A serialized ProseMirror JSON string (e.g. '{"type":"doc","content":[...]}')
 * - A raw HTML string or plain text string (legacy/fallback)
 * - Null or undefined (initializes empty document)
 */
import type { Editor } from "@tiptap/react";

export function parseDocumentContent(raw: string | null | undefined): JSONContent | string {
  if (!raw) return "";
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && (parsed.type === "doc" || parsed.content)) {
        return parsed as JSONContent;
      }
    } catch {
      // Fallback to raw string if JSON parsing fails
    }
  }
  return raw;
}

interface RichTextEditorProps {
  initialContent: string | null;
  canEdit: boolean;
  collabDoc?: Y.Doc | null;
  collabAwareness?: Awareness | null;
  onChange?: (contentJson: string) => void;
  onCountsChange?: (words: number, chars: number) => void;
  onEditorReady?: (editor: Editor) => void;
}

export function RichTextEditor({
  initialContent,
  canEdit,
  collabDoc,
  collabAwareness,
  onChange,
  onCountsChange,
  onEditorReady,
}: RichTextEditorProps) {
  const parsedContent = React.useMemo(() => {
    return parseDocumentContent(initialContent);
  }, [initialContent]);

  const extensions = React.useMemo(() => {
    const list: AnyExtension[] = [
      StarterKit.configure({
        // When Yjs collaboration is active, disable StarterKit's built-in undoRedo (history)
        // so that Yjs yUndoPlugin handles collaborative undo/redo without conflicts.
        undoRedo: collabDoc ? false : undefined,
        heading: {
          levels: [1, 2, 3],
        },
        link: false, // Explicitly disabled here so custom Link.configure below is the single source of truth
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "text-indigo-600 underline underline-offset-2 hover:text-indigo-800 transition-colors",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Placeholder.configure({
        placeholder: canEdit
          ? "Start writing, or use the toolbar above to format headings, lists, and links..."
          : "This document is empty.",
      }),
    ];

    if (collabDoc) {
      list.push(
        Collaboration.configure({
          document: collabDoc,
          field: "default",
        })
      );

      if (collabAwareness) {
        list.push(
          CollaborationCaret.configure({
            awareness: collabAwareness,
          })
        );
      }
    }

    return list;
  }, [collabDoc, collabAwareness, canEdit]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: canEdit,
      // Always initialize with parsedContent from PostgreSQL so editor never mounts blank.
      // If Yjs collaborative editing is active, Tiptap's Collaboration extension binds to the Y.Doc fragment.
      content: parsedContent,
      extensions,
      editorProps: {
        attributes: {
          class:
            "tiptap focus:outline-none min-h-[360px] p-4 sm:p-6 text-slate-800 dark:text-slate-900 text-sm sm:text-base leading-relaxed",
        },
      },
      onCreate({ editor: currentEditor }) {
        const text = currentEditor.getText();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        onCountsChange?.(words, text.length);
        onEditorReady?.(currentEditor);
      },
      onUpdate({ editor: currentEditor }) {
        const json = currentEditor.getJSON();
        const serialized = JSON.stringify(json);
        onChange?.(serialized);
        const text = currentEditor.getText();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        onCountsChange?.(words, text.length);
      },
    },
    [collabDoc, collabAwareness, canEdit, extensions]
  );

  React.useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  // Synchronize editor content if initialContent changes externally (e.g. version restore or reload)
  React.useEffect(() => {
    if (editor && !editor.isDestroyed && !collabDoc && initialContent !== null) {
      const currentJson = JSON.stringify(editor.getJSON());
      const nextParsed = parseDocumentContent(initialContent);
      const nextJson = typeof nextParsed === "object" ? JSON.stringify(nextParsed) : nextParsed;
      if (currentJson !== nextJson && !editor.isFocused) {
        editor.commands.setContent(nextParsed);
      }
    }
  }, [editor, initialContent, collabDoc]);

  // Keep editable state synced with permissions
  React.useEffect(() => {
    if (editor && editor.isEditable !== canEdit) {
      editor.setEditable(canEdit);
    }
  }, [editor, canEdit]);

  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-200 bg-white dark:bg-white shadow-2xs overflow-hidden transition-all focus-within:border-indigo-300 dark:focus-within:border-indigo-600 focus-within:shadow-xs">
      {canEdit && <EditorToolbar editor={editor} disabled={!canEdit} />}
      <div className="relative">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
