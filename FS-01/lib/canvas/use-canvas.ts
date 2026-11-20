"use client";

import * as React from "react";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import {
  CanvasNode,
  CanvasNodeType,
  CanvasTool,
  CanvasViewport,
  CanvasPoint,
  CanvasSaveStatus,
  PersistedCanvasData,
  CanvasCollaborator,
  CollabConnectionStatus,
} from "@/types/canvas";
import {
  zoomAroundPoint,
  createDefaultNode,
  calculateFitToView,
  ZOOM_STEP,
} from "./utils";

interface UseCanvasOptions {
  workspaceId: string;
  canEdit?: boolean;
  authorName?: string;
  initialCanvas?: PersistedCanvasData;
  initialNodes?: CanvasNode[];
}

export function useCanvas({
  workspaceId,
  canEdit = true,
  authorName = "You",
  initialCanvas,
  initialNodes = [],
}: UseCanvasOptions) {
  // LocalStorage storage key scoped per workspace as offline fallback
  const storageKey = `syncspace:canvas:${workspaceId}`;

  // Initial nodes from server or localStorage
  const [nodes, setNodes] = React.useState<CanvasNode[]>(() => {
    if (initialCanvas?.nodes && initialCanvas.nodes.length > 0) {
      return initialCanvas.nodes;
    }
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // Fallback
      }
    }
    return initialNodes;
  });

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = React.useState<string | null>(null);
  const [activeTool, setActiveTool] = React.useState<CanvasTool>("select");

  const [viewport, setViewport] = React.useState<CanvasViewport>(() => {
    return initialCanvas?.viewport ?? { x: 0, y: 0, zoom: 1.0 };
  });

  // Version and metadata state
  const [canvasVersion, setCanvasVersion] = React.useState<number>(
    initialCanvas?.version ?? 0
  );
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(
    initialCanvas?.updatedAt ?? null
  );

  // Autosave status states
  const [saveStatus, setSaveStatus] = React.useState<CanvasSaveStatus>("saved");
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Real-time collaboration state
  const [collaborators, setCollaborators] = React.useState<CanvasCollaborator[]>([]);
  const [collabStatus, setCollabStatus] = React.useState<CollabConnectionStatus>("connecting");
  const hasConnectedOnceRef = React.useRef(false);
  const ydocRef = React.useRef<Y.Doc | null>(null);
  const providerRef = React.useRef<WebsocketProvider | null>(null);
  const yNodesRef = React.useRef<Y.Map<CanvasNode> | null>(null);
  const isRemoteApplyingRef = React.useRef(false);

  // Undo / Redo history
  const [history, setHistory] = React.useState<CanvasNode[][]>([nodes]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(0);
  const isHistoryActionRef = React.useRef(false);

  // Concurrency & Autosave refs
  const nodesRef = React.useRef<CanvasNode[]>(nodes);
  const viewportRef = React.useRef<CanvasViewport>(viewport);

  React.useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  React.useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const lastSavedNodesJsonRef = React.useRef<string>(
    JSON.stringify(initialCanvas?.nodes ?? nodes)
  );
  const lastSavedViewportJsonRef = React.useRef<string>(
    JSON.stringify(initialCanvas?.viewport ?? viewport)
  );

  const saveSeqRef = React.useRef<number>(0);
  const latestHandledSeqRef = React.useRef<number>(0);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const performSaveRef = React.useRef<(force?: boolean) => Promise<void>>(() => Promise.resolve());

  // Sync to localStorage on changes as local client cache
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(nodes));
      } catch {
        // Ignore quota limits
      }
    }
  }, [nodes, storageKey]);

  // Real-time collaboration initialization with Yjs and y-websocket
  React.useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const yNodes = ydoc.getMap<CanvasNode>("nodes");
    yNodesRef.current = yNodes;

    async function initCollab() {
      try {
        const searchParams =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
        const portOverride =
          searchParams?.get("collabPort") || searchParams?.get("port");

        const tokenUrl = `/api/workspaces/${workspaceId}/canvas/collab-token${
          portOverride ? `?port=${encodeURIComponent(portOverride)}` : ""
        }`;

        const res = await fetch(tokenUrl);
        if (!res.ok) {
          throw new Error("Could not obtain canvas collaboration token");
        }
        const data = await res.json();
        const token = data.token;
        const serverWsUrl = data.wsUrl;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const fallbackWs = `${protocol}//${window.location.hostname}:${portOverride || "1234"}`;
        const wsEndpoint =
          serverWsUrl || process.env.NEXT_PUBLIC_COLLAB_WS_URL || fallbackWs;

        if (!isMounted) {
          ydoc.destroy();
          return;
        }

        const { WebsocketProvider } = await import("y-websocket");
        const roomName = `${workspaceId}:canvas`;
        const provider = new WebsocketProvider(wsEndpoint, roomName, ydoc, {
          params: { token: token || "" },
          disableBc: true,
          connect: true,
          maxBackoffTime: 5000,
          resyncInterval: 15000,
        });
        providerRef.current = provider;

        // Set initial user presence state
        if (data.user) {
          provider.awareness.setLocalState({
            user: {
              userId: data.user.userId,
              userName: data.user.userName,
              role: data.user.role,
              canEdit: data.user.canEdit,
              color: data.user.color,
            },
            cursor: null,
            selectedNodeId: null,
          });
        }

        // Connection timeout: fallback to disconnected after 3.5s if not synced
        timeoutId = setTimeout(() => {
          if (isMounted && !provider.synced) {
            setCollabStatus("disconnected");
          }
        }, 3500);

        // Status change listener (handles Connecting, Connected, Reconnecting, Disconnected)
        provider.on(
          "status",
          (event: { status: "connecting" | "connected" | "disconnected" }) => {
            if (!isMounted) return;
            if (event.status === "connected") {
              hasConnectedOnceRef.current = true;
              setCollabStatus("connected");
            } else if (event.status === "connecting") {
              setCollabStatus(hasConnectedOnceRef.current ? "reconnecting" : "connecting");
            } else if (event.status === "disconnected") {
              setCollabStatus("disconnected");
            }
          }
        );

        // Connection close handler: permanently halt reconnect loop on security rejections
        provider.on("connection-close", (event: CloseEvent | null) => {
          if (!isMounted) return;
          if (event && (event.code === 4401 || event.code === 4403 || event.code === 4404)) {
            console.warn(
              `[CanvasCollab] Connection permanently rejected by server (code ${event.code}): ${event.reason}. Halting auto-reconnect.`
            );
            provider.shouldConnect = false;
            setCollabStatus("disconnected");
          }
        });

        // Deduplicated extraction and synchronization from Yjs nodes
        const syncFromYjsNodes = () => {
          if (!isMounted || !yNodesRef.current) return;
          const remoteList: CanvasNode[] = [];
          const seenIds = new Set<string>();

          yNodesRef.current.forEach((node) => {
            if (node && typeof node === "object" && node.id && !seenIds.has(node.id)) {
              seenIds.add(node.id);
              remoteList.push(node);
            }
          });

          remoteList.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
          isRemoteApplyingRef.current = true;
          setNodes(remoteList);
          lastSavedNodesJsonRef.current = JSON.stringify(remoteList);
          setSaveStatus("saved");
          setTimeout(() => {
            isRemoteApplyingRef.current = false;
          }, 50);
        };

        // Yjs synchronization event handler
        provider.on("sync", (isSynced: boolean) => {
          if (!isMounted || !isSynced) return;
          hasConnectedOnceRef.current = true;
          setCollabStatus("connected");

          // Hydrate local state from remote Yjs nodes
          if (yNodes.size > 0) {
            syncFromYjsNodes();
          } else if (nodesRef.current.length > 0 && canEdit) {
            // Seed server doc with existing initial nodes if server was empty
            ydoc.transact(() => {
              for (const node of nodesRef.current) {
                yNodes.set(node.id, node);
              }
            }, "persistence-init");
          }
        });

        // Listen for Yjs remote changes (ignores local UI origin transactions to prevent update loops)
        yNodes.observe((event) => {
          if (
            event.transaction.origin === "local-ui" ||
            event.transaction.origin === "persistence-init"
          ) {
            return;
          }
          syncFromYjsNodes();
        });

        // Listen for remote awareness / presence / cursor changes
        const handleAwarenessChange = () => {
          if (!isMounted) return;
          const states = provider.awareness.getStates();
          const currentClientId = provider.awareness.clientID;
          const list: CanvasCollaborator[] = [];

          states.forEach((state, cId) => {
            if (cId === currentClientId) return; // Do not include local client
            if (state && state.user && typeof state.user === "object") {
              const u = state.user as Record<string, unknown>;
              let userColor = "#6366f1";
              if (u.color && typeof u.color === "object" && "hex" in (u.color as object)) {
                userColor = (u.color as { hex: string }).hex;
              } else if (typeof u.color === "string") {
                userColor = u.color;
              }

              list.push({
                clientId: cId,
                userId: (u.userId as string) || `user-${cId}`,
                userName: (u.userName as string) || "Anonymous",
                color: userColor,
                role: (u.role as string) || "MEMBER",
                canEdit: Boolean(u.canEdit ?? true),
                cursor: (state.cursor as CanvasPoint) || null,
                selectedNodeId: (state.selectedNodeId as string) || null,
                lastActive: Date.now(),
              });
            }
          });

          setCollaborators(list);
        };

        provider.awareness.on("change", handleAwarenessChange);
        handleAwarenessChange();
      } catch (err) {
        console.warn(
          "[CanvasCollab] Failed to connect to collaboration server, running in offline/REST mode:",
          err
        );
        if (isMounted) {
          setCollabStatus("disconnected");
        }
      }
    }

    initCollab();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (providerRef.current) {
        providerRef.current.shouldConnect = false;
        try {
          providerRef.current.awareness.setLocalState(null);
        } catch {}
        providerRef.current.destroy();
        providerRef.current = null;
      }
      ydoc.destroy();
      ydocRef.current = null;
      yNodesRef.current = null;
    };
  }, [workspaceId, canEdit]);

  // Synchronize local selection state to awareness
  React.useEffect(() => {
    if (providerRef.current?.awareness) {
      providerRef.current.awareness.setLocalStateField("selectedNodeId", selectedNodeId);
    }
  }, [selectedNodeId]);

  // Push new state to undo/redo history
  const pushHistory = React.useCallback(
    (newNodes: CanvasNode[]) => {
      if (isHistoryActionRef.current) {
        isHistoryActionRef.current = false;
        return;
      }
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        next.push(newNodes);
        if (next.length > 40) next.shift(); // Max 40 history states
        return next;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 39));
    },
    [historyIndex]
  );

  // Dispatches actual save request to server
  const performSave = React.useCallback(
    async (force: boolean = false) => {
      if (!canEdit) return;

      const currentNodes = nodesRef.current;
      const currentViewport = viewportRef.current;
      const currentNodesJson = JSON.stringify(currentNodes);
      const currentViewportJson = JSON.stringify(currentViewport);

      if (
        !force &&
        currentNodesJson === lastSavedNodesJsonRef.current &&
        currentViewportJson === lastSavedViewportJsonRef.current
      ) {
        setSaveStatus("saved");
        return;
      }

      const thisSeq = ++saveSeqRef.current;
      setSaveStatus("saving");
      setSaveError(null);

      try {
        const payload = {
          nodes: currentNodes,
          viewport: currentViewport,
          expectedVersion: canvasVersion > 0 ? canvasVersion : undefined,
        };

        const res = await fetch(`/api/workspaces/${workspaceId}/canvas`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        // Discard response if a newer save was already dispatched in the meantime
        if (thisSeq < latestHandledSeqRef.current) {
          return;
        }
        latestHandledSeqRef.current = thisSeq;

        if (res.status === 409) {
          setSaveStatus("conflict");
          setSaveError(
            data.error ||
              "Canvas conflict: newer changes exist on the server. Reload to synchronize."
          );
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || "Failed to persist canvas changes.");
        }

        // Successfully saved
        lastSavedNodesJsonRef.current = currentNodesJson;
        lastSavedViewportJsonRef.current = currentViewportJson;
        setCanvasVersion(data.canvas?.version ?? canvasVersion + 1);
        setLastSavedAt(data.canvas?.updatedAt ?? new Date().toISOString());

        // Check if user made additional edits while request was in-flight
        if (
          JSON.stringify(nodesRef.current) === currentNodesJson &&
          JSON.stringify(viewportRef.current) === currentViewportJson
        ) {
          setSaveStatus("saved");
          setSaveError(null);
        } else {
          // Additional unsaved changes occurred; schedule next debounced save
          setSaveStatus("unsaved");
          debounceTimerRef.current = setTimeout(() => {
            performSaveRef.current(false);
          }, 1200);
        }
      } catch (err: unknown) {
        if (thisSeq >= latestHandledSeqRef.current) {
          latestHandledSeqRef.current = thisSeq;
          setSaveStatus("error");
          setSaveError(
            err instanceof Error
              ? err.message
              : "Could not persist canvas changes. Retrying..."
          );
        }
      }
    },
    [canEdit, workspaceId, canvasVersion]
  );

  React.useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  // Schedules debounced autosave
  const scheduleAutosave = React.useCallback(() => {
    if (!canEdit || isRemoteApplyingRef.current) return;

    setSaveStatus("unsaved");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performSave(false);
    }, 1000);
  }, [canEdit, performSave]);

  // Clean up debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Undo
  const undo = React.useCallback(() => {
    if (!canEdit || historyIndex <= 0) return;
    const targetIndex = historyIndex - 1;
    isHistoryActionRef.current = true;
    const targetNodes = history[targetIndex];
    setNodes(targetNodes);
    setHistoryIndex(targetIndex);
    setSelectedNodeId(null);
    setEditingNodeId(null);
    scheduleAutosave();
  }, [canEdit, history, historyIndex, scheduleAutosave]);

  // Redo
  const redo = React.useCallback(() => {
    if (!canEdit || historyIndex >= history.length - 1) return;
    const targetIndex = historyIndex + 1;
    isHistoryActionRef.current = true;
    const targetNodes = history[targetIndex];
    setNodes(targetNodes);
    setHistoryIndex(targetIndex);
    setSelectedNodeId(null);
    setEditingNodeId(null);
    scheduleAutosave();
  }, [canEdit, history, historyIndex, scheduleAutosave]);

  // Max zIndex helper
  const getMaxZIndex = React.useCallback(() => {
    if (nodes.length === 0) return 10;
    return Math.max(...nodes.map((n) => n.zIndex || 0), 10);
  }, [nodes]);

  // Add node
  const addNode = React.useCallback(
    (
      type: CanvasNodeType,
      worldPos?: CanvasPoint,
      options?: Partial<CanvasNode>
    ) => {
      if (!canEdit) return null;

      const pos = worldPos || {
        x: -viewport.x / viewport.zoom + 200,
        y: -viewport.y / viewport.zoom + 150,
      };

      const nextZ = getMaxZIndex() + 1;
      const newNode = createDefaultNode(type, pos, workspaceId, {
        authorName,
        zIndex: nextZ,
        ...options,
      });

      if (yNodesRef.current) {
        ydocRef.current?.transact(() => {
          yNodesRef.current?.set(newNode.id, newNode);
        }, "local-ui");
      }

      const nextNodes = [...nodes, newNode];
      setNodes(nextNodes);
      pushHistory(nextNodes);
      setSelectedNodeId(newNode.id);
      setActiveTool("select");
      scheduleAutosave();
      return newNode;
    },
    [canEdit, viewport, getMaxZIndex, workspaceId, authorName, nodes, pushHistory, scheduleAutosave]
  );

  // Update node
  const updateNode = React.useCallback(
    (id: string, updates: Partial<CanvasNode>) => {
      if (!canEdit) return;

      if (yNodesRef.current) {
        const existing = yNodesRef.current.get(id);
        const updated = {
          ...(existing || {}),
          ...updates,
          updatedAt: Date.now(),
        } as CanvasNode;
        ydocRef.current?.transact(() => {
          yNodesRef.current?.set(id, updated);
        }, "local-ui");
      }

      setNodes((prev) => {
        const nextNodes = prev.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              ...updates,
              updatedAt: Date.now(),
            };
          }
          return node;
        });
        pushHistory(nextNodes);
        return nextNodes;
      });
      scheduleAutosave();
    },
    [canEdit, pushHistory, scheduleAutosave]
  );

  // Move node
  const moveNode = React.useCallback(
    (id: string, x: number, y: number) => {
      if (!canEdit) return;

      setNodes((prev) =>
        prev.map((node) => (node.id === id ? { ...node, x, y } : node))
      );
    },
    [canEdit]
  );

  // Resize node
  const resizeNode = React.useCallback(
    (
      id: string,
      width: number,
      height: number,
      x?: number,
      y?: number
    ) => {
      if (!canEdit) return;

      const minW = 60;
      const minH = 40;
      const clampedW = Math.max(minW, width);
      const clampedH = Math.max(minH, height);

      setNodes((prev) =>
        prev.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              width: clampedW,
              height: clampedH,
              x: x !== undefined ? x : node.x,
              y: y !== undefined ? y : node.y,
              updatedAt: Date.now(),
            };
          }
          return node;
        })
      );
    },
    [canEdit]
  );

  // Delete node
  const deleteNode = React.useCallback(
    (id: string) => {
      if (!canEdit) return;

      if (yNodesRef.current) {
        ydocRef.current?.transact(() => {
          yNodesRef.current?.delete(id);
        }, "local-ui");
      }

      setNodes((prev) => {
        const nextNodes = prev.filter((node) => node.id !== id);
        pushHistory(nextNodes);
        return nextNodes;
      });

      if (selectedNodeId === id) {
        setSelectedNodeId(null);
      }
      if (editingNodeId === id) {
        setEditingNodeId(null);
      }
      scheduleAutosave();
    },
    [canEdit, pushHistory, selectedNodeId, editingNodeId, scheduleAutosave]
  );

  // Delete selected node
  const deleteSelected = React.useCallback(() => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
    }
  }, [selectedNodeId, deleteNode]);

  // Duplicate selected node
  const duplicateSelected = React.useCallback(() => {
    if (!canEdit || !selectedNodeId) return;

    const source = nodes.find((n) => n.id === selectedNodeId);
    if (!source) return;

    const duplicated = createDefaultNode(
      source.type,
      { x: source.x + 30, y: source.y + 30 },
      workspaceId,
      {
        ...source,
        id: undefined,
        zIndex: getMaxZIndex() + 1,
        authorName,
      }
    );

    const nextNodes = [...nodes, duplicated];
    setNodes(nextNodes);
    pushHistory(nextNodes);
    setSelectedNodeId(duplicated.id);
    scheduleAutosave();
  }, [canEdit, selectedNodeId, nodes, workspaceId, getMaxZIndex, authorName, pushHistory, scheduleAutosave]);

  // Layering
  const bringForward = React.useCallback(
    (id: string) => {
      if (!canEdit) return;
      const maxZ = getMaxZIndex();
      updateNode(id, { zIndex: maxZ + 1 });
    },
    [canEdit, getMaxZIndex, updateNode]
  );

  const sendBackward = React.useCallback(
    (id: string) => {
      if (!canEdit) return;
      const minZ = nodes.length > 0 ? Math.min(...nodes.map((n) => n.zIndex || 0), 0) : 0;
      updateNode(id, { zIndex: Math.max(0, minZ - 1) });
    },
    [canEdit, nodes, updateNode]
  );

  // Clear all nodes
  const clearCanvas = React.useCallback(() => {
    if (!canEdit || nodes.length === 0) return;

    if (yNodesRef.current) {
      ydocRef.current?.transact(() => {
        const keys = Array.from(yNodesRef.current?.keys() || []);
        for (const k of keys) {
          yNodesRef.current?.delete(k);
        }
      }, "local-ui");
    }

    setNodes([]);
    pushHistory([]);
    setSelectedNodeId(null);
    setEditingNodeId(null);
    scheduleAutosave();
  }, [canEdit, nodes.length, pushHistory, scheduleAutosave]);

  // Pan by delta
  const panBy = React.useCallback((deltaX: number, deltaY: number) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }));
  }, []);

  // Zoom at cursor
  const zoomAt = React.useCallback(
    (mousePoint: CanvasPoint, nextZoom: number) => {
      setViewport((prev) => zoomAroundPoint(prev, mousePoint, nextZoom));
    },
    []
  );

  // Zoom In
  const zoomIn = React.useCallback(
    (centerPoint?: CanvasPoint) => {
      setViewport((prev) => {
        const pt = centerPoint || {
          x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
          y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
        };
        return zoomAroundPoint(prev, pt, prev.zoom + ZOOM_STEP);
      });
    },
    []
  );

  // Zoom Out
  const zoomOut = React.useCallback(
    (centerPoint?: CanvasPoint) => {
      setViewport((prev) => {
        const pt = centerPoint || {
          x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
          y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
        };
        return zoomAroundPoint(prev, pt, prev.zoom - ZOOM_STEP);
      });
    },
    []
  );

  // Reset Viewport
  const resetViewport = React.useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1.0 });
  }, []);

  // Fit to view
  const fitToView = React.useCallback(
    (containerWidth: number, containerHeight: number) => {
      const nextViewport = calculateFitToView(nodes, containerWidth, containerHeight);
      setViewport(nextViewport);
    },
    [nodes]
  );

  // Select node
  const selectNode = React.useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (!id) {
      setEditingNodeId(null);
    }
    if (providerRef.current?.awareness) {
      providerRef.current.awareness.setLocalStateField("selectedNodeId", id);
    }
  }, []);

  // Manual save trigger
  const saveNow = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return performSave(true);
  }, [performSave]);

  // Reload canvas from server (e.g. after conflict)
  const reloadCanvas = React.useCallback(async () => {
    try {
      setSaveStatus("saving");
      const res = await fetch(`/api/workspaces/${workspaceId}/canvas`);
      if (!res.ok) throw new Error("Failed to reload canvas");
      const data = await res.json();
      if (data.canvas) {
        setNodes(data.canvas.nodes || []);
        if (data.canvas.viewport) {
          setViewport(data.canvas.viewport);
        }
        setCanvasVersion(data.canvas.version || 1);
        setLastSavedAt(data.canvas.updatedAt || new Date().toISOString());
        lastSavedNodesJsonRef.current = JSON.stringify(data.canvas.nodes || []);
        lastSavedViewportJsonRef.current = JSON.stringify(data.canvas.viewport || { x: 0, y: 0, zoom: 1 });
        setSaveStatus("saved");
        setSaveError(null);
      }
    } catch (err: unknown) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Failed to reload canvas");
    }
  }, [workspaceId]);

  // Get selected node
  const selectedNode = React.useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  // Broadcast world-space cursor position to collaborators
  const updateCursor = React.useCallback((pos: CanvasPoint | null) => {
    if (providerRef.current?.awareness) {
      providerRef.current.awareness.setLocalStateField("cursor", pos);
    }
  }, []);

  return {
    nodes,
    selectedNode,
    selectedNodeId,
    editingNodeId,
    activeTool,
    viewport,
    canEdit,
    canUndo: canEdit && historyIndex > 0,
    canRedo: canEdit && historyIndex < history.length - 1,
    saveStatus,
    saveError,
    canvasVersion,
    lastSavedAt,
    saveNow,
    reloadCanvas,
    scheduleAutosave,
    undo,
    redo,
    addNode,
    updateNode,
    moveNode,
    resizeNode,
    deleteNode,
    deleteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    clearCanvas,
    panBy,
    zoomAt,
    zoomIn,
    zoomOut,
    resetViewport,
    fitToView,
    selectNode,
    setEditingNodeId,
    setActiveTool,
    setViewport,
    collaborators,
    collabStatus,
    updateCursor,
  };
}
