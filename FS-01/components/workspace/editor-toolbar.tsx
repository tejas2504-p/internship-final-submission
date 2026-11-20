"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Unlink,
  Undo,
  Redo,
  Minus,
  Check,
  X,
} from "lucide-react";

interface EditorToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
}

export function EditorToolbar({ editor, disabled = false }: EditorToolbarProps) {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkText, setLinkText] = React.useState("");
  const [selectedText, setSelectedText] = React.useState("");
  const [isSelectionEmpty, setIsSelectionEmpty] = React.useState(true);
  const linkInputRef = React.useRef<HTMLInputElement>(null);
  const modalContainerRef = React.useRef<HTMLDivElement>(null);
  const savedSelectionRef = React.useRef<{
    from: number;
    to: number;
    empty: boolean;
    selectedText: string;
  } | null>(null);

  // Re-render toolbar when editor selection or formatting changes
  React.useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      forceUpdate();
    };

    editor.on("transaction", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);

    return () => {
      editor.off("transaction", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor]);

  // Handle outside click and Escape key dismissal of the link popover
  React.useEffect(() => {
    if (!isLinkModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLinkModalOpen(false);
        setSelectedText("");
        setIsSelectionEmpty(true);
        savedSelectionRef.current = null;
        editor?.commands.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalContainerRef.current &&
        !modalContainerRef.current.contains(e.target as Node)
      ) {
        setIsLinkModalOpen(false);
        setSelectedText("");
        setIsSelectionEmpty(true);
        savedSelectionRef.current = null;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLinkModalOpen, editor]);

  if (!editor) {
    return null;
  }

  const handleOpenLinkModal = () => {
    const { from, to, empty } = editor.state.selection;
    const text = empty ? "" : editor.state.doc.textBetween(from, to, " ");
    savedSelectionRef.current = { from, to, empty, selectedText: text };

    const previousUrl = editor.getAttributes("link").href || "";
    setLinkUrl(previousUrl);
    setLinkText(text);
    setSelectedText(text);
    setIsSelectionEmpty(empty);
    setIsLinkModalOpen(true);

    setTimeout(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }, 50);
  };

  const handleApplyLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = linkUrl.trim();
    const saved = savedSelectionRef.current;

    // 1. Restore editor selection accurately
    if (saved && !saved.empty) {
      editor.chain().focus().setTextSelection({ from: saved.from, to: saved.to }).run();
    } else if (saved) {
      editor.chain().focus().setTextSelection(saved.from).run();
    } else {
      editor.chain().focus().run();
    }

    // 2. Apply or remove link
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const validUrl =
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("mailto:") ||
        trimmed.startsWith("tel:")
          ? trimmed
          : `https://${trimmed}`;

      const currentSelection = editor.state.selection;

      if (!currentSelection.empty) {
        // Selected text: apply link mark across the entire selection
        editor
          .chain()
          .focus()
          .setLink({ href: validUrl })
          .run();
      } else {
        // Cursor only (no selection): insert displayText with link mark
        const displayText = linkText.trim() || validUrl;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: displayText,
            marks: [
              {
                type: "link",
                attrs: { href: validUrl },
              },
            ],
          })
          .run();
      }
    }

    setIsLinkModalOpen(false);
    setSelectedText("");
    setIsSelectionEmpty(true);
    savedSelectionRef.current = null;
  };

  const handleRemoveLink = () => {
    const saved = savedSelectionRef.current;
    if (saved && !saved.empty) {
      editor.chain().focus().setTextSelection({ from: saved.from, to: saved.to }).run();
    } else {
      editor.chain().focus().run();
    }
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setIsLinkModalOpen(false);
    setSelectedText("");
    setIsSelectionEmpty(true);
    savedSelectionRef.current = null;
  };

  const isLinkActive = editor.isActive("link");

  return (
    <div className="relative border-b border-slate-200 dark:border-slate-200 bg-slate-50/90 dark:bg-slate-50/90 px-3 py-2 rounded-t-xl flex items-center flex-wrap gap-1 text-slate-700 dark:text-slate-800 select-none">
      {/* Group: History (Undo / Redo) */}
      <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 dark:border-slate-200">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().undo()}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus-ring"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().redo()}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus-ring"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Group: Headings */}
      <div className="flex items-center gap-0.5 px-1.5 border-r border-slate-200 dark:border-slate-200">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={disabled}
          title="Heading 1"
          aria-label="Heading 1"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("heading", { level: 1 })
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
          title="Heading 2"
          aria-label="Heading 2"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("heading", { level: 2 })
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled}
          title="Heading 3"
          aria-label="Heading 3"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("heading", { level: 3 })
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <Heading3 className="w-4 h-4" />
        </button>
      </div>

      {/* Group: Inline Formatting */}
      <div className="flex items-center gap-0.5 px-1.5 border-r border-slate-200 dark:border-slate-200">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("bold")
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("italic")
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
          title="Strikethrough"
          aria-label="Strikethrough"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("strike")
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={disabled}
          title="Inline Code"
          aria-label="Inline Code"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("code")
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <Code className="w-4 h-4" />
        </button>
      </div>

      {/* Group: Lists */}
      <div className="flex items-center gap-0.5 px-1.5 border-r border-slate-200 dark:border-slate-200">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          title="Bulleted List"
          aria-label="Bulleted List"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("bulletList")
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          title="Numbered List"
          aria-label="Numbered List"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("orderedList")
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>

      {/* Group: Blocks & Structure */}
      <div className="flex items-center gap-0.5 px-1.5 border-r border-slate-200 dark:border-slate-200">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled}
          title="Blockquote"
          aria-label="Blockquote"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            editor.isActive("blockquote")
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          disabled={disabled}
          title="Horizontal Divider"
          aria-label="Horizontal Divider"
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors focus-ring"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Group: Links */}
      <div className="flex items-center gap-0.5 pl-1.5 relative">
        <button
          type="button"
          onMouseDown={(e) => {
            // Prevent mousedown from stealing focus or collapsing selection
            e.preventDefault();
          }}
          onClick={handleOpenLinkModal}
          disabled={disabled}
          title={isLinkActive ? "Edit Link" : "Add Link (Ctrl+K)"}
          aria-label="Link"
          className={`p-1.5 rounded-lg transition-colors focus-ring ${
            isLinkActive
              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 font-semibold shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          }`}
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        {isLinkActive && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleRemoveLink}
            disabled={disabled}
            title="Remove Link"
            aria-label="Remove Link"
            className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors focus-ring"
          >
            <Unlink className="w-4 h-4" />
          </button>
        )}

        {/* Link URL Modal Popover */}
        {isLinkModalOpen && (
          <div
            ref={modalContainerRef}
            className="absolute top-full left-0 z-50 mt-1.5 p-3.5 rounded-xl bg-white dark:bg-white border border-slate-200 dark:border-slate-200 shadow-xl dark:shadow-black/50 w-80 text-xs space-y-3"
          >
            <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-900">
              <span className="flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{isLinkActive ? "Edit Link" : "Insert Link"}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsLinkModalOpen(false);
                  savedSelectionRef.current = null;
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedText && (
              <div className="bg-slate-50 dark:bg-slate-50 border border-slate-200/70 dark:border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-[11px] truncate">
                <span className="text-slate-400 font-medium">Text:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-800 truncate max-w-[200px]">
                  &ldquo;{selectedText}&rdquo;
                </span>
              </div>
            )}

            <form onSubmit={handleApplyLink} className="space-y-2.5">
              {isSelectionEmpty && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Display Text (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My Website"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-900 bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Destination URL
                </label>
                <input
                  ref={linkInputRef}
                  type="text"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-900 bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1">
                {isLinkActive && (
                  <button
                    type="button"
                    onClick={handleRemoveLink}
                    className="px-2 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded text-xs font-medium mr-auto"
                  >
                    Unlink
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsLinkModalOpen(false);
                    savedSelectionRef.current = null;
                  }}
                  className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1 shadow-2xs transition-colors focus-ring"
                >
                  <Check className="w-3 h-3" />
                  <span>Apply</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
