"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Save,
  Trash2,
  Clock,
  User,
  Check,
  AlertCircle,
  Eye,
  Loader2,
  RotateCcw,
  MessageSquare,
  History,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import type { Awareness } from "y-protocols/awareness";
import type { Editor } from "@tiptap/react";
import dynamic from "next/dynamic";
import { RichTextEditor, parseDocumentContent } from "./rich-text-editor";
import { CollaboratorPresence } from "./collaborator-presence";
import { type VersionItem } from "./version-history-panel";

const CommentsPanel = dynamic(
  () => import("./comments-panel").then((m) => m.CommentsPanel),
  { ssr: false }
);

const VersionHistoryPanel = dynamic(
  () => import("./version-history-panel").then((m) => m.VersionHistoryPanel),
  { ssr: false }
);

export interface PageData {
  id: string;
  title: string;
  content: string | null;
  workspaceId: string;
  createdById: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  currentUserRole: "OWNER" | "ADMIN" | "EDITOR" | "MEMBER" | "VIEWER";
  canEdit: boolean;
  canDelete: boolean;
  commentsCount?: number;
}

interface PageEditorViewProps {
  page: PageData;
  initialCollabToken?: string;
  initialCommentCount?: number;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type ActiveSidebar = "none" | "comments" | "history";

export function PageEditorView({
  page: initialPage,
  initialCollabToken,
  initialCommentCount,
}: PageEditorViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [page, setPage] = React.useState<PageData>(initialPage);
  const [title, setTitle] = React.useState(initialPage.title);
  const [content, setContent] = React.useState(initialPage.content || "");
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("saved");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [wordCount, setWordCount] = React.useState(0);
  const [charCount, setCharCount] = React.useState(0);

  // Sidebars and Panels State (Phase 6B)
  const [activeSidebar, setActiveSidebar] = React.useState<ActiveSidebar>("none");
  const [commentCount, setCommentCount] = React.useState(
    initialCommentCount ?? initialPage.commentsCount ?? 0
  );
  const [previewingVersion, setPreviewingVersion] = React.useState<VersionItem | null>(null);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [restoreFeedback, setRestoreFeedback] = React.useState<string | null>(null);

  // Real-time collaboration state (Yjs & y-websocket)
  const [collabDoc, setCollabDoc] = React.useState<Y.Doc | null>(null);
  const [collabAwareness, setCollabAwareness] = React.useState<Awareness | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string>("");
  const [collabStatus, setCollabStatus] = React.useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [connectedServerUrl, setConnectedServerUrl] = React.useState<string | null>(null);
  const [collabError, setCollabError] = React.useState<string | null>(null);
  const providerRef = React.useRef<WebsocketProvider | null>(null);
  const docRef = React.useRef<Y.Doc | null>(null);
  const editorRef = React.useRef<Editor | null>(null);
  const performSaveRef = React.useRef<(isManual?: boolean) => Promise<void>>(async () => {});

  // References to keep track of latest edits and avoid stale closures
  const titleRef = React.useRef(title);
  const contentRef = React.useRef(content);
  const lastSavedTitleRef = React.useRef(initialPage.title);
  const lastSavedContentRef = React.useRef(initialPage.content || "");

  // Race condition and sequence counters
  const saveSeqRef = React.useRef(0);
  const latestHandledSeqRef = React.useRef(0);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Keep refs synchronized with state
  const collabStatusRef = React.useRef(collabStatus);
  React.useEffect(() => {
    collabStatusRef.current = collabStatus;
  }, [collabStatus]);

  React.useEffect(() => {
    titleRef.current = title;
  }, [title]);

  React.useEffect(() => {
    contentRef.current = content;
  }, [content]);


  // Clean up debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Flush pending changes when component unmounts or user navigates between pages
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const isDirty =
        titleRef.current !== lastSavedTitleRef.current ||
        contentRef.current !== lastSavedContentRef.current;

      if (isDirty && page.canEdit) {
        const payload = JSON.stringify({
          title: titleRef.current.trim() || "Untitled",
          content: contentRef.current,
        });
        fetch(`/api/workspaces/${page.workspaceId}/pages/${page.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [page.id, page.workspaceId, page.canEdit]);

  // Fetch initial comment count on page mount only if not already provided by server
  React.useEffect(() => {
    if (initialCommentCount !== undefined || initialPage.commentsCount !== undefined) {
      return;
    }

    fetch(`/api/workspaces/${page.workspaceId}/pages/${page.id}/comments`)
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.comments && Array.isArray(data.comments)) {
          setCommentCount(data.comments.length);
        }
      })
      .catch(() => {});
  }, [page.workspaceId, page.id, initialCommentCount, initialPage.commentsCount]);

  // Warn user on beforeunload if there are unsaved changes
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (previewingVersion) return; // Previewing does not create dirty state

      const isDirty =
        titleRef.current !== lastSavedTitleRef.current ||
        contentRef.current !== lastSavedContentRef.current;

      if (isDirty || saveStatus === "saving" || saveStatus === "unsaved") {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveStatus, previewingVersion]);

  // Set up real-time collaboration with Yjs and y-websocket
  React.useEffect(() => {
    let isMounted = true;
    let connectionTimeout: NodeJS.Timeout | null = null;
    const ydoc = new Y.Doc();
    docRef.current = ydoc;

    async function initCollab() {
      try {
        const searchParams =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
        const portOverride =
          searchParams?.get("collabPort") || searchParams?.get("port");

        let token = initialCollabToken;
        let serverWsUrl: string | undefined = undefined;
        let authUser: {
          userId: string;
          userName: string;
          role: string;
          canEdit: boolean;
          color: string;
        } | null = null;

        // If no server-provided token or testing with port override, query the token API
        if (!token || portOverride) {
          const tokenUrl = `/api/workspaces/${page.workspaceId}/pages/${page.id}/collab-token${
            portOverride ? `?port=${encodeURIComponent(portOverride)}` : ""
          }`;

          const res = await fetch(tokenUrl);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to obtain collaboration token.");
          }

          const data = await res.json();
          token = data.token;
          serverWsUrl = data.wsUrl;
          if (data.user) {
            authUser = data.user;
            if (data.user.userId) {
              setCurrentUserId(data.user.userId);
            }
          }
        } else {
          // Decode local token payload for immediate presence setup
          try {
            const payloadPart = token.split(".")[0];
            const parsed = JSON.parse(
              atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"))
            );
            authUser = {
              userId: parsed.userId,
              userName: parsed.userName,
              role: parsed.role,
              canEdit: parsed.canEdit,
              color: "#6366f1",
            };
            setCurrentUserId(parsed.userId);
          } catch {
            // Token parsing fallback
          }
        }

        if (!isMounted) {
          ydoc.destroy();
          return;
        }

        // Dynamically import WebsocketProvider for browser execution
        const { WebsocketProvider } = await import("y-websocket");

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const fallbackWs = `${protocol}//${window.location.hostname}:${portOverride || "1234"}`;
        const wsEndpoint =
          serverWsUrl || process.env.NEXT_PUBLIC_COLLAB_WS_URL || fallbackWs;

        setConnectedServerUrl(wsEndpoint);

        // Connection timeout: If server does not connect & sync within 3.5s, fall back to offline database mode
        connectionTimeout = setTimeout(() => {
          if (isMounted && collabStatusRef.current !== "connected") {
            console.warn(
              "[Collab] Connection attempt timed out. Operating in reliable database persistence mode."
            );
            setCollabStatus("disconnected");
            setCollabError("Collaboration server unavailable. Edits persist directly to PostgreSQL.");
            if (providerRef.current) {
              providerRef.current.destroy();
              providerRef.current = null;
            }
            setCollabDoc(null);
            setCollabAwareness(null);
          }
        }, 3500);

        const roomName = `${page.workspaceId}:${page.id}`;
        const provider = new WebsocketProvider(wsEndpoint, roomName, ydoc, {
          params: { token: token || "" },
          disableBc: true,
          connect: true,
        });

        providerRef.current = provider;

        // Set authenticated user presence state in awareness
        if (authUser) {
          const hexColor =
            typeof authUser.color === "object" && authUser.color !== null && "hex" in authUser.color
              ? (authUser.color as { hex: string }).hex
              : typeof authUser.color === "string"
              ? authUser.color
              : "#6366f1";

          provider.awareness.setLocalStateField("user", {
            userId: authUser.userId,
            userName: authUser.userName,
            role: authUser.role,
            canEdit: authUser.canEdit,
            color: hexColor,
            colorDetails: authUser.color,
          });
        }

        provider.on(
          "status",
          ({ status }: { status: "connecting" | "connected" | "disconnected" }) => {
            if (isMounted) {
              if (status === "disconnected" && collabStatusRef.current === "connected") {
                setCollabStatus("disconnected");
                setCollabDoc(null);
                setCollabAwareness(null);
              }
            }
          }
        );

        provider.on("sync", (isSynced: boolean) => {
          if (isSynced && isMounted) {
            if (connectionTimeout) clearTimeout(connectionTimeout);
            setCollabStatus("connected");
            setCollabError(null);
            // ONLY attach collabDoc once synchronization with server is confirmed
            setCollabDoc(ydoc);
            setCollabAwareness(provider.awareness);
          }
        });

        provider.on("connection-close", (event: CloseEvent | null) => {
          if (isMounted) {
            if (event?.code === 4403) {
              if (connectionTimeout) clearTimeout(connectionTimeout);
              setCollabError("Access denied by collaboration server");
              setCollabStatus("disconnected");
              setCollabDoc(null);
              setCollabAwareness(null);
            }
          }
        });
      } catch (err: unknown) {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        if (isMounted) {
          console.warn(
            "[Collab] Collaboration server unavailable, falling back to local autosave:",
            err instanceof Error ? err.message : String(err)
          );
          setCollabStatus("disconnected");
          setCollabDoc(null);
          setCollabAwareness(null);
        }
        ydoc.destroy();
      }
    }

    initCollab();

    return () => {
      isMounted = false;
      if (connectionTimeout) clearTimeout(connectionTimeout);
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
      }
      setCollabDoc(null);
      setCollabAwareness(null);
    };
  }, [page.id, page.workspaceId, initialCollabToken]);

  // Core save executor
  const performSave = React.useCallback(
    async (isManual = false) => {
      if (!page.canEdit || previewingVersion) return;

      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const snapshotTitle = titleRef.current;
      const snapshotContent = contentRef.current;
      const trimmedTitle = snapshotTitle.trim() || "Untitled";

      // Guard: prevent empty initial/transient glitch from overwriting non-empty saved database content
      const isEmptyDefault =
        !snapshotContent ||
        snapshotContent.trim() === "" ||
        snapshotContent.trim() === '{"type":"doc","content":[{"type":"paragraph"}]}';
      const hadSubstantialContent =
        lastSavedContentRef.current &&
        lastSavedContentRef.current.length > 60 &&
        lastSavedContentRef.current !== '{"type":"doc","content":[{"type":"paragraph"}]}';

      if (isEmptyDefault && hadSubstantialContent && !isManual) {
        console.warn("[Save] Skipped autosave: transient empty state detected while document has saved content.");
        return;
      }

      // If already matching what's on server and not a manual retry, skip
      const isTitleDirty = snapshotTitle !== lastSavedTitleRef.current;
      const isContentDirty = snapshotContent !== lastSavedContentRef.current;

      if (!isManual && !isTitleDirty && !isContentDirty) {
        setSaveStatus("saved");
        return;
      }

      const thisSeq = ++saveSeqRef.current;
      setSaveStatus("saving");
      setSaveError(null);

      try {
        // ALWAYS send content via REST to ensure PostgreSQL pages.content is the durable source of truth
        const payload: { title: string; content: string } = {
          title: trimmedTitle,
          content: snapshotContent,
        };

        const res = await fetch(
          `/api/workspaces/${page.workspaceId}/pages/${page.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to save page changes.");
        }

        // Stale response check: discard if a newer save request was already dispatched
        if (thisSeq < latestHandledSeqRef.current) {
          return;
        }
        latestHandledSeqRef.current = thisSeq;

        // Update last saved snapshot to what was confirmed by database
        lastSavedTitleRef.current = snapshotTitle;
        lastSavedContentRef.current = snapshotContent;

        setPage((prev) => ({
          ...prev,
          title: trimmedTitle,
          content: snapshotContent,
          updatedAt: data.page?.updatedAt || new Date().toISOString(),
        }));

        // Check if user continued typing while save was in-flight
        if (
          titleRef.current === snapshotTitle &&
          contentRef.current === snapshotContent
        ) {
          setSaveStatus("saved");
          if (isManual) {
            addToast("Document changes saved", "success");
          }
        } else {
          // Additional unsaved changes exist; queue next debounced save
          setSaveStatus("unsaved");
          debounceTimerRef.current = setTimeout(() => {
            performSaveRef.current();
          }, 1200);
        }
      } catch (err: unknown) {
        if (thisSeq >= latestHandledSeqRef.current) {
          latestHandledSeqRef.current = thisSeq;
          setSaveStatus("error");
          const errorMsg =
            err instanceof Error
              ? err.message
              : "Could not save document changes. Retrying when connection restores.";
          setSaveError(errorMsg);
          if (isManual) {
            addToast(errorMsg, "error");
          }
        }
      }
    },
    [page.canEdit, page.workspaceId, page.id, previewingVersion, addToast]
  );

  React.useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  // Trigger debounced autosave on change
  const scheduleAutosave = React.useCallback(
    (newTitle: string, newContent: string) => {
      if (!page.canEdit || previewingVersion) return;

      const isDirty =
        newTitle !== lastSavedTitleRef.current ||
        newContent !== lastSavedContentRef.current;

      if (!isDirty) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        setSaveStatus("saved");
        setSaveError(null);
        return;
      }

      setSaveStatus("unsaved");

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        performSaveRef.current();
      }, 1200);
    },
    [page.canEdit, previewingVersion]
  );

  const handleTitleChange = (val: string) => {
    if (previewingVersion) return;
    setTitle(val);
    titleRef.current = val;
    scheduleAutosave(val, contentRef.current);
  };

  const handleContentChange = (val: string) => {
    if (previewingVersion) return;
    setContent(val);
    contentRef.current = val;
    scheduleAutosave(titleRef.current, val);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${page.title}"?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/workspaces/${page.workspaceId}/pages/${page.id}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete page.");

      router.push(`/workspaces/${page.workspaceId}`);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete page.");
      setIsDeleting(false);
    }
  };

  // Restore version handler
  const handleRestoreVersion = async (versionToRestore: VersionItem) => {
    if (!page.canEdit) return;

    setIsRestoring(true);
    try {
      const res = await fetch(
        `/api/workspaces/${page.workspaceId}/pages/${page.id}/versions/${versionToRestore.id}/restore`,
        {
          method: "POST",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to restore version.");
      }

      const restoredTitle = versionToRestore.title || page.title;
      const restoredContent = versionToRestore.content || "";

      // 1. Update state & refs to restored data
      setTitle(restoredTitle);
      setContent(restoredContent);
      titleRef.current = restoredTitle;
      contentRef.current = restoredContent;
      lastSavedTitleRef.current = restoredTitle;
      lastSavedContentRef.current = restoredContent;

      setPage((prev) => ({
        ...prev,
        title: restoredTitle,
        content: restoredContent,
        updatedAt: data.page?.updatedAt || new Date().toISOString(),
      }));

      // 2. Synchronize active Tiptap collaborative editor and broadcast via Yjs
      if (editorRef.current) {
        const parsed = parseDocumentContent(restoredContent);
        editorRef.current.commands.setContent(parsed);
      }

      // 3. Clear preview mode and show success notice
      setPreviewingVersion(null);
      setSaveStatus("saved");
      addToast("Version restored successfully", "success");
      setRestoreFeedback(
        `Restored document to version from ${new Date(
          versionToRestore.createdAt
        ).toLocaleString()}`
      );
      setTimeout(() => setRestoreFeedback(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to restore version.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link
            href={`/workspaces/${page.workspaceId}`}
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-medium text-slate-700 dark:text-slate-300"
          >
            {page.workspace.name}
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-slate-900 font-semibold truncate max-w-[200px]">
            {previewingVersion ? previewingVersion.title : title || "Untitled"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Collaborator Presence Avatars */}
          {!previewingVersion && (
            <CollaboratorPresence
              awareness={collabAwareness}
              currentUserId={currentUserId}
            />
          )}

          {/* Real-Time Collaboration Status Badge */}
          {!previewingVersion && collabStatus === "connected" && (
            <span
              id="collab-status-badge"
              title={`Connected to real-time collaboration server: ${connectedServerUrl || "ws://localhost:1234"}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Live Sync{" "}
                {connectedServerUrl
                  ? `(${connectedServerUrl.replace(/^wss?:\/\/[^:]+:/, ":")})`
                  : ""}
              </span>
            </span>
          )}
          {!previewingVersion && collabStatus === "connecting" && (
            <span
              title="Connecting to collaboration server..."
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80"
            >
              <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
              <span>Connecting</span>
            </span>
          )}
          {!previewingVersion && collabStatus === "disconnected" && (
            <span
              title={collabError || "Collaboration server offline. Local edits persist directly to PostgreSQL."}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-200"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Offline (DB Mode)</span>
            </span>
          )}

          {/* Spatial Canvas Link */}
          <Link
            href={`/workspaces/${page.workspaceId}/canvas`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-white dark:bg-slate-50 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200/90 dark:border-indigo-800/80 shadow-2xs transition-colors focus-ring"
            title="Open Workspace Spatial Canvas"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Canvas</span>
          </Link>

          {/* Comments Panel Toggle */}
          <button
            type="button"
            id="toggle-comments-btn"
            onClick={() =>
              setActiveSidebar((prev) => (prev === "comments" ? "none" : "comments"))
            }
            title="Toggle comments"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-colors border shadow-2xs focus-ring ${
              activeSidebar === "comments"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white dark:bg-slate-50 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-800 border-slate-200/90 dark:border-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Comments</span>
            {commentCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSidebar === "comments"
                    ? "bg-white text-indigo-700"
                    : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                }`}
              >
                {commentCount}
              </span>
            )}
          </button>

          {/* Version History Toggle */}
          <button
            type="button"
            id="toggle-history-btn"
            onClick={() =>
              setActiveSidebar((prev) => (prev === "history" ? "none" : "history"))
            }
            title="Toggle version history"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-colors border shadow-2xs focus-ring ${
              activeSidebar === "history"
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white dark:bg-slate-50 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-800 border-slate-200/90 dark:border-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
          </button>

          {/* Autosave & Save Controls */}
          {page.canEdit ? (
            <div className="flex items-center gap-2 text-xs">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-sky-600 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </span>
              )}

              {saveStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Saved</span>
                </span>
              )}

              {saveStatus === "unsaved" && (
                <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Unsaved</span>
                </span>
              )}

              {saveStatus === "error" && (
                <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save failed</span>
                </span>
              )}

              <Button
                variant={saveStatus === "error" ? "primary" : "primary"}
                size="sm"
                onClick={() => performSave(true)}
                isLoading={saveStatus === "saving"}
                disabled={saveStatus === "saved" || !!previewingVersion}
                className={saveStatus === "error" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
              >
                {saveStatus === "error" ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    <span>Retry</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    <span>{saveStatus === "unsaved" ? "Save now" : "Save"}</span>
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              <Eye className="w-3.5 h-3.5" />
              <span>Read-Only Viewer</span>
            </div>
          )}

          {page.canDelete && !previewingVersion && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              isLoading={isDeleting}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Restore Feedback Notification */}
      {restoreFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{restoreFeedback}</span>
        </div>
      )}

      {/* Save Error Banner */}
      {saveError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span><strong>Autosave paused:</strong> {saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => performSave(true)}
            className="px-2.5 py-1 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 text-xs shrink-0 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Historical Version Preview Mode Banner */}
      {previewingVersion && (
        <div
          id="version-preview-banner"
          className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-200/90 text-amber-900 flex items-center justify-center shrink-0 shadow-2xs">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                <span>Previewing Historical Version</span>
                {previewingVersion.description && (
                  <span className="italic font-medium text-amber-800">
                    ({previewingVersion.description})
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 font-semibold">
                  Read-Only Mode
                </span>
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                Snapshot from{" "}
                <strong>
                  {new Date(previewingVersion.createdAt).toLocaleString()}
                </strong>{" "}
                by {previewingVersion.creator.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewingVersion(null)}
              className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100/60"
            >
              Exit Preview
            </Button>

            {page.canEdit && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleRestoreVersion(previewingVersion)}
                isLoading={isRestoring}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                <span>Restore This Version</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace Canvas & Sidebars Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Editor Main Canvas */}
        <div className="flex-1 w-full min-w-0 rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-200 p-6 sm:p-10 shadow-xs space-y-6 min-h-[500px]">
          {/* Title Input */}
          <div className="border-b border-slate-100 dark:border-slate-200 pb-4">
            <input
              type="text"
              value={previewingVersion ? previewingVersion.title : title}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={!page.canEdit || !!previewingVersion}
              readOnly={!page.canEdit || !!previewingVersion}
              placeholder="Untitled Document"
              className="w-full text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-900 bg-transparent placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none disabled:opacity-80"
            />
          </div>

          {/* Rich-Text Tiptap Editor Canvas */}
          <div>
            {previewingVersion ? (
              // Historical Preview Mode: Dedicated read-only instance detached from live Yjs
              <RichTextEditor
                key={`preview-${previewingVersion.id}`}
                initialContent={previewingVersion.content}
                canEdit={false}
                collabDoc={null}
                collabAwareness={null}
                onCountsChange={(words, chars) => {
                  setWordCount(words);
                  setCharCount(chars);
                }}
              />
            ) : (
              // Live Collaborative or Standalone Editor
              <RichTextEditor
                key={page.id}
                initialContent={initialPage.content}
                canEdit={page.canEdit}
                collabDoc={collabDoc}
                collabAwareness={collabAwareness}
                onEditorReady={(editor) => {
                  editorRef.current = editor;
                }}
                onChange={handleContentChange}
                onCountsChange={(words, chars) => {
                  setWordCount(words);
                  setCharCount(chars);
                }}
              />
            )}
          </div>
        </div>

        {/* Dynamic Right Sidebar: Comments or Version History */}
        {activeSidebar === "comments" && (
          <CommentsPanel
            workspaceId={page.workspaceId}
            pageId={page.id}
            canComment={page.currentUserRole !== "VIEWER"}
            isOpen={true}
            onClose={() => setActiveSidebar("none")}
            onCommentCountChange={setCommentCount}
          />
        )}

        {activeSidebar === "history" && (
          <VersionHistoryPanel
            workspaceId={page.workspaceId}
            pageId={page.id}
            canEdit={page.canEdit}
            isOpen={true}
            previewingVersionId={previewingVersion?.id || null}
            onClose={() => setActiveSidebar("none")}
            onPreviewVersion={(v) => setPreviewingVersion(v)}
            onRestoreVersion={handleRestoreVersion}
            isRestoring={isRestoring}
          />
        )}
      </div>

      {/* Document Metadata Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-white border border-slate-200/80 dark:border-slate-200 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Created by <strong className="text-slate-700 dark:text-slate-800">{page.creator.name}</strong>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Updated{" "}
              {new Date(page.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          <span>•</span>
          <span>{charCount} characters</span>
        </div>
      </div>
    </div>
  );
}
