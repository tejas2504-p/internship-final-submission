"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import {
  SketchElement,
  SketchboardTool,
  SketchboardViewport,
  Point,
  BoundingBox,
  ResizeHandle,
  AlignmentType,
  AlignmentGuide,
  GridMode,
  CanvasBgTheme,
  StrokeStyle,
  SketchElementType,
  SketchboardCollaborator,
  SketchboardSaveStatus,
  CollabConnectionStatus,
  PersistedSketchboardData,
} from "@/types/sketchboard";
import {
  screenToWorld,
  zoomAroundPoint,
  calculateFitToView,
  generateElementId,
  createDefaultSketchElement,
  getElementsBoundingBox,
  getElementBoundingBox,
  pointInElement,
  elementIntersectsBox,
  alignElements,
  distributeElements,
  reorderElements,
  calculateAlignmentGuides,
  snapToGrid,
  parseSketchboardJson,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from "./utils";

const HISTORY_LIMIT = 50;
const MAX_AUTO_SAVE_RETRIES = 3;

interface UseSketchboardOptions {
  workspaceId: string;
  boardId?: string;
  initialName?: string;
  authorName?: string;
  initialSketchboard?: PersistedSketchboardData;
  canEdit?: boolean;
}

export function useSketchboard({
  workspaceId,
  boardId,
  initialName = "Workspace Sketchboard",
  authorName = "You",
  initialSketchboard,
  canEdit: initialCanEdit = true,
}: UseSketchboardOptions) {
  const activeBoardId = boardId || initialSketchboard?.id;
  // --- Persistent & Core State ---
  const [boardName, setBoardName] = useState<string>(
    initialSketchboard?.name || initialName
  );
  const [elements, setElements] = useState<SketchElement[]>(
    initialSketchboard?.elements || []
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<SketchboardTool>("select");
  const [viewport, setViewport] = useState<SketchboardViewport>(
    initialSketchboard?.viewport || { x: 0, y: 0, zoom: 1.0 }
  );
  const [gridMode, setGridMode] = useState<GridMode>(
    initialSketchboard?.gridMode || "dots"
  );
  const [canvasBg, setCanvasBg] = useState<CanvasBgTheme>(
    initialSketchboard?.canvasBg || "white"
  );
  const [saveStatus, setSaveStatus] = useState<SketchboardSaveStatus>("saved");
  const [canEdit, setCanEdit] = useState<boolean>(
    initialSketchboard?.canEdit ?? initialCanEdit
  );

  // --- Real-Time Collaboration & Presence State ---
  const [collabStatus, setCollabStatus] =
    useState<CollabConnectionStatus>("connecting");
  const [collaborators, setCollaborators] = useState<SketchboardCollaborator[]>(
    []
  );

  // --- Active Property Defaults ---
  const [strokeColor, setStrokeColor] = useState<string>("#0284c7");
  const [fillColor, setFillColor] = useState<string>("transparent");
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>("solid");
  const [opacity, setOpacity] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(18);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");
  const [textColor, setTextColor] = useState<string>("#0f172a");

  // --- Ephemeral Drawing & Interaction State ---
  const [currentDrawingElement, setCurrentDrawingElement] =
    useState<SketchElement | null>(null);
  const [selectionMarquee, setSelectionMarquee] = useState<BoundingBox | null>(
    null
  );
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  // --- History Stack ---
  const historyRef = useRef<SketchElement[][]>(
    initialSketchboard?.elements ? [initialSketchboard.elements] : []
  );
  const historyIndexRef = useRef<number>(
    initialSketchboard?.elements?.length ? 0 : -1
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // --- Version Tracking ---
  const currentVersionRef = useRef<number>(initialSketchboard?.version || 1);

  // --- Yjs & Collab Refs ---
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const yElementsRef = useRef<Y.Map<SketchElement> | null>(null);
  const isApplyingRemoteChangeRef = useRef(false);
  const cursorThrottleRef = useRef<number>(0);
  const hasConnectedOnceRef = useRef(false);

  // --- Internal Clipboard ---
  const clipboardRef = useRef<SketchElement[]>([]);
  const saveToBackendRef = useRef<((retryAttempt?: number) => Promise<void>) | null>(null);

  // --- Interaction Tracking Refs ---
  const interactionRef = useRef<{
    mode:
      | "none"
      | "pan"
      | "drag"
      | "draw"
      | "resize"
      | "rotate"
      | "marquee"
      | "erase";
    startScreen: Point;
    startWorld: Point;
    dragElementStarts?: Map<
      string,
      { x: number; y: number; startPoint?: Point; endPoint?: Point }
    >;
    resizeHandle?: ResizeHandle;
    initialBox?: BoundingBox;
    initialElements?: SketchElement[];
    initialElementSnapshot?: SketchElement;
    erasedIds?: Set<string>;
  }>({
    mode: "none",
    startScreen: { x: 0, y: 0 },
    startWorld: { x: 0, y: 0 },
  });

  const elementsRef = useRef<SketchElement[]>(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  const lastResizedElementsRef = useRef<SketchElement[] | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update undo/redo availability flags
  const updateHistoryFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  // --- Sync local state into Yjs CRDT ---
  const syncToYjs = useCallback((newElements: SketchElement[]) => {
    if (isApplyingRemoteChangeRef.current) return;
    const ydoc = ydocRef.current;
    const yElements = yElementsRef.current;
    if (!ydoc || !yElements) return;

    ydoc.transact(() => {
      const currentKeys = new Set(yElements.keys());
      const nextIds = new Set<string>();

      newElements.forEach((el) => {
        nextIds.add(el.id);
        const existing = yElements.get(el.id);
        if (!existing || existing.updatedAt !== el.updatedAt) {
          yElements.set(el.id, el);
        }
      });

      currentKeys.forEach((key) => {
        if (!nextIds.has(key)) {
          yElements.delete(key);
        }
      });
    }, "local-change");
  }, []);

  // --- Commit state change (React state + Undo/Redo history + Yjs CRDT) ---
  const commitElements = useCallback(
    (newElements: SketchElement[]) => {
      setElements(newElements);
      setSaveStatus("unsaved");

      // Truncate redo branches
      const currentIndex = historyIndexRef.current;
      const nextHistory = historyRef.current.slice(0, currentIndex + 1);
      nextHistory.push(newElements);

      if (nextHistory.length > HISTORY_LIMIT) {
        nextHistory.shift();
      }

      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;
      updateHistoryFlags();

      // Transact into Yjs for real-time collaboration
      syncToYjs(newElements);
    },
    [updateHistoryFlags, syncToYjs]
  );

  // --- REAL-TIME YJS & WEBSOCKET COLLABORATION LIFECYCLE ---
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const yElements = ydoc.getMap<SketchElement>("elements");
    yElementsRef.current = yElements;

    async function setupCollaboration() {
      try {
        setCollabStatus("connecting");
        const searchParams =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
        const portOverride =
          searchParams?.get("collabPort") || searchParams?.get("port");

        const tokenUrl = activeBoardId
          ? `/api/workspaces/${workspaceId}/sketchboards/${activeBoardId}/collab-token${
              portOverride ? `?port=${encodeURIComponent(portOverride)}` : ""
            }`
          : `/api/workspaces/${workspaceId}/sketchboard/collab-token${
              portOverride ? `?port=${encodeURIComponent(portOverride)}` : ""
            }`;

        const res = await fetch(tokenUrl);
        if (!res.ok) {
          throw new Error("Could not obtain sketchboard collaboration token");
        }

        const data = await res.json();
        const token = data.token;
        const serverWsUrl = data.wsUrl;
        const protocol =
          window.location.protocol === "https:" ? "wss:" : "ws:";
        const fallbackWs = `${protocol}//${window.location.hostname}:${
          portOverride || "1234"
        }`;
        const wsEndpoint =
          serverWsUrl || process.env.NEXT_PUBLIC_COLLAB_WS_URL || fallbackWs;

        if (!isMounted) {
          ydoc.destroy();
          return;
        }

        if (data.canEdit !== undefined) {
          setCanEdit(data.canEdit);
        }

        const { WebsocketProvider } = await import("y-websocket");
        const roomName = activeBoardId
          ? `${workspaceId}:sketchboard:${activeBoardId}`
          : `${workspaceId}:sketchboard`;
        const provider = new WebsocketProvider(wsEndpoint, roomName, ydoc, {
          params: { token: token || "" },
          disableBc: true,
          connect: true,
          maxBackoffTime: 5000,
          resyncInterval: 15000,
        });
        providerRef.current = provider;

        // Set initial user presence in Awareness
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
            selectedIds: [],
          });
        }

        // Connection status tracking
        provider.on(
          "status",
          (event: { status: "connecting" | "connected" | "disconnected" }) => {
            if (!isMounted) return;
            if (event.status === "connected") {
              hasConnectedOnceRef.current = true;
              setCollabStatus("connected");
            } else if (event.status === "connecting") {
              setCollabStatus(
                hasConnectedOnceRef.current ? "reconnecting" : "connecting"
              );
            } else if (event.status === "disconnected") {
              setCollabStatus("disconnected");
            }
          }
        );

        // Security rejection handler: halt reconnect loop
        provider.on("connection-close", (event: CloseEvent | null) => {
          if (!isMounted) return;
          if (
            event &&
            (event.code === 4401 ||
              event.code === 4403 ||
              event.code === 4404)
          ) {
            console.warn(
              `[SketchboardCollab] Connection rejected by server (${event.code}): ${event.reason}.`
            );
            provider.shouldConnect = false;
            setCollabStatus("disconnected");
          }
        });

        // Sync Yjs elements to local state
        const syncFromYjsElements = () => {
          if (!isMounted || !yElementsRef.current) return;
          const remoteList: SketchElement[] = [];
          const seenIds = new Set<string>();

          yElementsRef.current.forEach((el) => {
            if (el && el.id && !seenIds.has(el.id)) {
              seenIds.add(el.id);
              remoteList.push(el);
            }
          });

          // Sort by zIndex
          remoteList.sort((a, b) => a.zIndex - b.zIndex);

          isApplyingRemoteChangeRef.current = true;
          setElements(remoteList);
          isApplyingRemoteChangeRef.current = false;
        };

        yElements.observe((event) => {
          if (event.transaction.origin !== "local-change") {
            syncFromYjsElements();
          }
        });

        // Awareness listener for live peer cursors & presence
        const handleAwarenessChange = () => {
          if (!isMounted || !providerRef.current) return;
          const states = providerRef.current.awareness.getStates();
          const localClientId = providerRef.current.awareness.clientID;
          const activePeers: SketchboardCollaborator[] = [];

          states.forEach((state, clientId) => {
            if (clientId === localClientId) return; // skip self
            if (state.user) {
              activePeers.push({
                clientId,
                userId: state.user.userId,
                userName: state.user.userName,
                color: state.user.color || "#0284c7",
                role: state.user.role || "MEMBER",
                canEdit: state.user.canEdit ?? true,
                cursor: state.cursor || null,
                selectedIds: state.selectedIds || [],
                lastActive: Date.now(),
              });
            }
          });

          setCollaborators(activePeers);
        };

        provider.awareness.on("change", handleAwarenessChange);

        // Fallback timeout
        timeoutId = setTimeout(() => {
          if (isMounted && !provider.synced) {
            setCollabStatus("disconnected");
          }
        }, 4000);
      } catch (err) {
        console.warn("[SketchboardCollab] Fallback to standalone mode:", err);
        if (isMounted) setCollabStatus("disconnected");
      }
    }

    setupCollaboration();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current.destroy();
        providerRef.current = null;
      }
      ydoc.destroy();
      ydocRef.current = null;
      yElementsRef.current = null;
    };
  }, [workspaceId]);

  // --- AUTOMATIC SAVING & POSTGRESQL PERSISTENCE (with Retry Logic) ---
  const saveToBackend = useCallback(
    async (retryAttempt = 0) => {
      if (!canEdit) return;
      try {
        setSaveStatus("saving");
        const payload = {
          name: boardName,
          elements,
          viewport,
          gridMode,
          canvasBg,
          expectedVersion: currentVersionRef.current,
        };

        const saveEndpoint = activeBoardId
          ? `/api/workspaces/${workspaceId}/sketchboards/${activeBoardId}`
          : `/api/workspaces/${workspaceId}/sketchboard`;

        const res = await fetch(saveEndpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 409) {
          // Concurrency conflict
          const data = await res.json();
          setSaveStatus("conflict");
          if (data.currentVersion) {
            currentVersionRef.current = data.currentVersion;
          }
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to save: ${res.statusText}`);
        }

        const data = await res.json();
        if (data.sketchboard?.version) {
          currentVersionRef.current = data.sketchboard.version;
        }

        // Backup to localStorage as client safety insurance
        try {
          const storageKey = `syncspace:sketchboard:${workspaceId}${
            activeBoardId ? `:${activeBoardId}` : ""
          }`;
          localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {}

        setSaveStatus("saved");
      } catch (err) {
        console.warn(
          `[SketchboardAutoSave] Attempt ${retryAttempt + 1} failed:`,
          err
        );
        if (retryAttempt < MAX_AUTO_SAVE_RETRIES) {
          setTimeout(() => {
            saveToBackendRef.current?.(retryAttempt + 1);
          }, 1500 * Math.pow(2, retryAttempt));
        } else {
          setSaveStatus("error");
        }
      }
    },
    [boardName, elements, viewport, gridMode, canvasBg, workspaceId, canEdit, activeBoardId]
  );

  useEffect(() => {
    saveToBackendRef.current = saveToBackend;
  }, [saveToBackend]);

  // Debounced trigger for auto-save
  useEffect(() => {
    if (saveStatus !== "unsaved") return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      saveToBackend(0);
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [elements, boardName, viewport, gridMode, canvasBg, saveStatus, saveToBackend]);

  // --- Undo & Redo Handlers ---
  const undo = useCallback(() => {
    if (!canEdit || historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const targetState = historyRef.current[historyIndexRef.current];
    setElements(targetState);
    setSelectedIds(new Set());
    setSaveStatus("unsaved");
    updateHistoryFlags();
    syncToYjs(targetState);
  }, [canEdit, updateHistoryFlags, syncToYjs]);

  const redo = useCallback(() => {
    if (!canEdit || historyIndexRef.current >= historyRef.current.length - 1)
      return;
    historyIndexRef.current++;
    const targetState = historyRef.current[historyIndexRef.current];
    setElements(targetState);
    setSelectedIds(new Set());
    setSaveStatus("unsaved");
    updateHistoryFlags();
    syncToYjs(targetState);
  }, [canEdit, updateHistoryFlags, syncToYjs]);

  // --- Broadcast selection change via awareness ---
  const updateSelectedIds = useCallback((newSelection: Set<string>) => {
    setSelectedIds(newSelection);
    if (providerRef.current?.awareness) {
      providerRef.current.awareness.setLocalStateField(
        "selectedIds",
        Array.from(newSelection)
      );
    }
  }, []);

  // --- Element Selection Handlers ---
  const selectElement = useCallback(
    (id: string, isShift: boolean = false) => {
      const next = new Set(selectedIds);
      const target = elements.find((e) => e.id === id);

      // Group handling
      const groupMembers = target?.groupId
        ? elements
            .filter((e) => e.groupId === target.groupId)
            .map((e) => e.id)
        : [id];

      if (isShift) {
        const alreadySelected = groupMembers.every((mId) => next.has(mId));
        if (alreadySelected) {
          groupMembers.forEach((mId) => next.delete(mId));
        } else {
          groupMembers.forEach((mId) => next.add(mId));
        }
      } else {
        next.clear();
        groupMembers.forEach((mId) => next.add(mId));
      }

      // Sync active properties with selected element
      if (target) {
        setStrokeColor(target.strokeColor);
        setFillColor(target.fillColor);
        setStrokeWidth(target.strokeWidth);
        setStrokeStyle(target.strokeStyle);
        setOpacity(target.opacity);
        if (target.fontSize) setFontSize(target.fontSize);
        if (target.textAlign) setTextAlign(target.textAlign);
        if (target.textColor) setTextColor(target.textColor);
      }

      updateSelectedIds(next);
    },
    [elements, selectedIds, updateSelectedIds]
  );

  const selectAll = useCallback(() => {
    updateSelectedIds(new Set(elements.map((e) => e.id)));
  }, [elements, updateSelectedIds]);

  const clearSelection = useCallback(() => {
    updateSelectedIds(new Set());
  }, [updateSelectedIds]);

  const deleteSelected = useCallback(() => {
    if (!canEdit || selectedIds.size === 0) return;
    const remaining = elements.filter((e) => !selectedIds.has(e.id) || e.isLocked);
    if (remaining.length !== elements.length) {
      commitElements(remaining);
      // Keep only locked elements in selection if any were locked
      const remainingLocked = new Set(
        elements.filter((e) => selectedIds.has(e.id) && e.isLocked).map((e) => e.id)
      );
      updateSelectedIds(remainingLocked);
    }
  }, [canEdit, elements, selectedIds, commitElements, updateSelectedIds]);

  // --- Object Locking & Unlocking ---
  const toggleLockSelected = useCallback(() => {
    if (!canEdit || selectedIds.size === 0) return;
    const anyUnlocked = elements.some(
      (el) => selectedIds.has(el.id) && !el.isLocked
    );
    const targetLocked = anyUnlocked; // If any is unlocked, lock all; otherwise unlock
    const updated = elements.map((el) => {
      if (selectedIds.has(el.id)) {
        return { ...el, isLocked: targetLocked, updatedAt: Date.now() };
      }
      return el;
    });
    commitElements(updated);
  }, [canEdit, elements, selectedIds, commitElements]);

  // --- Clipboard (Copy, Paste, Duplicate) ---
  const copy = useCallback(() => {
    if (selectedIds.size === 0) return;
    const itemsToCopy = elements.filter((e) => selectedIds.has(e.id));
    clipboardRef.current = JSON.parse(JSON.stringify(itemsToCopy));
  }, [elements, selectedIds]);

  const paste = useCallback(
    (offset = 30) => {
      if (!canEdit || clipboardRef.current.length === 0) return;
      const newIds = new Set<string>();
      const pasted = clipboardRef.current.map((item) => {
        const newId = generateElementId(item.type.toLowerCase());
        newIds.add(newId);
        const clone: SketchElement = {
          ...item,
          id: newId,
          x: item.x + offset,
          y: item.y + offset,
          zIndex: item.zIndex + 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        if (clone.points) {
          clone.points = clone.points.map((p) => ({
            x: p.x + offset,
            y: p.y + offset,
          }));
        }
        if (clone.startPoint && clone.endPoint) {
          clone.startPoint = {
            x: clone.startPoint.x + offset,
            y: clone.startPoint.y + offset,
          };
          clone.endPoint = {
            x: clone.endPoint.x + offset,
            y: clone.endPoint.y + offset,
          };
        }
        return clone;
      });

      clipboardRef.current = pasted;
      commitElements([...elements, ...pasted]);
      updateSelectedIds(newIds);
    },
    [canEdit, elements, commitElements, updateSelectedIds]
  );

  const duplicate = useCallback(() => {
    if (selectedIds.size === 0) return;
    copy();
    paste(30);
  }, [copy, paste, selectedIds]);

  // --- Grouping & Ungrouping ---
  const groupSelected = useCallback(() => {
    if (!canEdit || selectedIds.size < 2) return;
    const groupId = generateElementId("group");
    const updated = elements.map((el) => {
      if (selectedIds.has(el.id)) {
        return { ...el, groupId, updatedAt: Date.now() };
      }
      return el;
    });
    commitElements(updated);
  }, [canEdit, elements, selectedIds, commitElements]);

  const ungroupSelected = useCallback(() => {
    if (!canEdit || selectedIds.size === 0) return;
    const updated = elements.map((el) => {
      if (selectedIds.has(el.id)) {
        const copyEl = { ...el, updatedAt: Date.now() };
        delete copyEl.groupId;
        return copyEl;
      }
      return el;
    });
    commitElements(updated);
  }, [canEdit, elements, selectedIds, commitElements]);

  // --- Layering Helpers ---
  const bringToFront = useCallback(() => {
    if (!canEdit) return;
    const next = reorderElements(elements, selectedIds, "front");
    commitElements(next);
  }, [canEdit, elements, selectedIds, commitElements]);

  const sendToBack = useCallback(() => {
    if (!canEdit) return;
    const next = reorderElements(elements, selectedIds, "back");
    commitElements(next);
  }, [canEdit, elements, selectedIds, commitElements]);

  const bringForward = useCallback(() => {
    if (!canEdit) return;
    const next = reorderElements(elements, selectedIds, "forward");
    commitElements(next);
  }, [canEdit, elements, selectedIds, commitElements]);

  const sendBackward = useCallback(() => {
    if (!canEdit) return;
    const next = reorderElements(elements, selectedIds, "backward");
    commitElements(next);
  }, [canEdit, elements, selectedIds, commitElements]);

  // --- Alignment & Distribution ---
  const align = useCallback(
    (type: AlignmentType) => {
      if (!canEdit) return;
      const next = alignElements(elements, selectedIds, type);
      commitElements(next);
    },
    [canEdit, elements, selectedIds, commitElements]
  );

  const distribute = useCallback(
    (direction: "horizontal" | "vertical") => {
      if (!canEdit) return;
      const next = distributeElements(elements, selectedIds, direction);
      commitElements(next);
    },
    [canEdit, elements, selectedIds, commitElements]
  );

  // --- Properties Mutation ---
  const updateSelectedProperties = useCallback(
    (patch: Partial<SketchElement>) => {
      if (patch.strokeColor !== undefined) setStrokeColor(patch.strokeColor);
      if (patch.fillColor !== undefined) setFillColor(patch.fillColor);
      if (patch.strokeWidth !== undefined) setStrokeWidth(patch.strokeWidth);
      if (patch.strokeStyle !== undefined) setStrokeStyle(patch.strokeStyle);
      if (patch.opacity !== undefined) setOpacity(patch.opacity);
      if (patch.fontSize !== undefined) setFontSize(patch.fontSize);
      if (patch.textAlign !== undefined) setTextAlign(patch.textAlign);
      if (patch.textColor !== undefined) setTextColor(patch.textColor);

      if (!canEdit || selectedIds.size === 0) return;

      const updated = elements.map((el) => {
        if (selectedIds.has(el.id)) {
          return { ...el, ...patch, updatedAt: Date.now() };
        }
        return el;
      });
      commitElements(updated);
    },
    [canEdit, elements, selectedIds, commitElements]
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<SketchElement>) => {
      if (!canEdit) return;
      const updated = elements.map((el) => {
        if (el.id === id) {
          return { ...el, ...patch, updatedAt: Date.now() };
        }
        return el;
      });
      commitElements(updated);
    },
    [canEdit, elements, commitElements]
  );

  // --- Image Insertion ---
  const insertImage = useCallback(
    (dataUrl: string, width = 360, height = 240) => {
      if (!canEdit) return;
      const centerScreen: Point = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      const centerWorld = screenToWorld(centerScreen, viewport);
      const imgElement = createDefaultSketchElement(
        "IMAGE",
        {
          x: centerWorld.x - width / 2,
          y: centerWorld.y - height / 2,
        },
        {
          width,
          height,
          imageUrl: dataUrl,
        }
      );

      commitElements([...elements, imgElement]);
      updateSelectedIds(new Set([imgElement.id]));
      setActiveTool("select");
    },
    [canEdit, elements, viewport, commitElements, updateSelectedIds]
  );

  // --- Zoom & Viewport Operations ---
  const zoomIn = useCallback(() => {
    setViewport((prev) => {
      const nextZoom = Math.min(MAX_ZOOM, prev.zoom + ZOOM_STEP);
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      return zoomAroundPoint(prev, center, nextZoom);
    });
  }, []);

  const zoomOut = useCallback(() => {
    setViewport((prev) => {
      const nextZoom = Math.max(MIN_ZOOM, prev.zoom - ZOOM_STEP);
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      return zoomAroundPoint(prev, center, nextZoom);
    });
  }, []);

  const resetZoom = useCallback(() => {
    setViewport((prev) => {
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      return zoomAroundPoint(prev, center, 1.0);
    });
  }, []);

  const setZoom = useCallback((targetZoom: number) => {
    setViewport((prev) => {
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      return zoomAroundPoint(prev, center, targetZoom);
    });
  }, []);

  const fitToScreen = useCallback(
    (containerWidth: number, containerHeight: number) => {
      const next = calculateFitToView(elements, containerWidth, containerHeight);
      setViewport(next);
    },
    [elements]
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  // --- POINTER EVENT HANDLERS (Canvas Engine & Awareness Cursor) ---

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, containerRect: DOMRect) => {
      const screenPoint: Point = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      };
      const worldPoint = screenToWorld(screenPoint, viewport);

      // Handle middle click, spacebar pan, or hand tool
      if (e.button === 1 || isSpacePressed || activeTool === "hand") {
        interactionRef.current = {
          mode: "pan",
          startScreen: screenPoint,
          startWorld: worldPoint,
        };
        setIsPanning(true);
        return;
      }

      if (e.button !== 0) return;

      // Read-only guard
      if (!canEdit && activeTool !== "select") {
        return;
      }

      // ERASER TOOL
      if (activeTool === "eraser" && canEdit) {
        interactionRef.current = {
          mode: "erase",
          startScreen: screenPoint,
          startWorld: worldPoint,
          erasedIds: new Set<string>(),
        };

        const hit = [...elements]
          .reverse()
          .find((el) => pointInElement(worldPoint, el));
        if (hit) {
          const remaining = elements.filter((el) => el.id !== hit.id);
          commitElements(remaining);
          interactionRef.current.erasedIds?.add(hit.id);
        }
        return;
      }

      // SELECT TOOL
      if (activeTool === "select") {
        const hit = [...elements]
          .reverse()
          .find((el) => pointInElement(worldPoint, el));

        if (hit) {
          const isShift = e.shiftKey || e.metaKey || e.ctrlKey;
          const nextSelection = new Set(selectedIds);

          if (!selectedIds.has(hit.id)) {
            if (!isShift) nextSelection.clear();
            const groupMembers = hit.groupId
              ? elements
                  .filter((el) => el.groupId === hit.groupId)
                  .map((el) => el.id)
              : [hit.id];
            groupMembers.forEach((id) => nextSelection.add(id));
            updateSelectedIds(nextSelection);
          } else if (isShift) {
            nextSelection.delete(hit.id);
            updateSelectedIds(nextSelection);
            return;
          }

          if (canEdit) {
            const dragStarts = new Map<
              string,
              { x: number; y: number; startPoint?: Point; endPoint?: Point }
            >();
            elements.forEach((el) => {
              if (nextSelection.has(el.id) && !el.isLocked) {
                dragStarts.set(el.id, {
                  x: el.x,
                  y: el.y,
                  startPoint: el.startPoint ? { ...el.startPoint } : undefined,
                  endPoint: el.endPoint ? { ...el.endPoint } : undefined,
                });
              }
            });

            if (dragStarts.size > 0) {
              interactionRef.current = {
                mode: "drag",
                startScreen: screenPoint,
                startWorld: worldPoint,
                dragElementStarts: dragStarts,
              };
            }
          }
          return;
        }

        // Clicked blank canvas -> Marquee selection
        if (!e.shiftKey) {
          updateSelectedIds(new Set());
        }
        interactionRef.current = {
          mode: "marquee",
          startScreen: screenPoint,
          startWorld: worldPoint,
        };
        setSelectionMarquee({
          minX: worldPoint.x,
          minY: worldPoint.y,
          maxX: worldPoint.x,
          maxY: worldPoint.y,
          width: 0,
          height: 0,
        });
        return;
      }

      if (!canEdit) return;

      // DRAWING TOOLS
      let elementType: SketchElementType = "RECTANGLE";
      if (activeTool === "pen") elementType = "PEN";
      else if (activeTool === "highlighter") elementType = "HIGHLIGHTER";
      else if (activeTool === "rectangle") elementType = "RECTANGLE";
      else if (activeTool === "circle") elementType = "CIRCLE";
      else if (activeTool === "ellipse") elementType = "ELLIPSE";
      else if (activeTool === "line") elementType = "LINE";
      else if (activeTool === "arrow") elementType = "ARROW";
      else if (activeTool === "diamond") elementType = "DIAMOND";
      else if (activeTool === "polygon") elementType = "POLYGON";
      else if (activeTool === "text") elementType = "TEXT";
      else if (activeTool === "sticky") elementType = "STICKY";
      else if (activeTool === "connector") elementType = "CONNECTOR";

      const newElement = createDefaultSketchElement(elementType, worldPoint, {
        strokeColor,
        fillColor,
        strokeWidth: activeTool === "highlighter" ? 24 : strokeWidth,
        strokeStyle,
        opacity: activeTool === "highlighter" ? 0.35 : opacity,
        fontSize,
        textAlign,
        textColor,
        authorName,
      });

      if (activeTool === "text" || activeTool === "sticky") {
        commitElements([...elements, newElement]);
        updateSelectedIds(new Set([newElement.id]));
        setActiveTool("select");
        return;
      }

      setCurrentDrawingElement(newElement);
      interactionRef.current = {
        mode: "draw",
        startScreen: screenPoint,
        startWorld: worldPoint,
      };
    },
    [
      viewport,
      isSpacePressed,
      activeTool,
      canEdit,
      elements,
      selectedIds,
      strokeColor,
      fillColor,
      strokeWidth,
      strokeStyle,
      opacity,
      fontSize,
      textAlign,
      textColor,
      authorName,
      commitElements,
      updateSelectedIds,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, containerRect: DOMRect) => {
      const screenPoint: Point = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      };
      const worldPoint = screenToWorld(screenPoint, viewport);

      // Throttled live cursor broadcasting to peers (~30ms)
      const now = Date.now();
      if (
        now - cursorThrottleRef.current > 30 &&
        providerRef.current?.awareness
      ) {
        cursorThrottleRef.current = now;
        providerRef.current.awareness.setLocalStateField("cursor", {
          x: Math.round(worldPoint.x),
          y: Math.round(worldPoint.y),
        });
      }

      const { mode, startScreen, startWorld } = interactionRef.current;

      if (mode === "pan") {
        const dx = screenPoint.x - startScreen.x;
        const dy = screenPoint.y - startScreen.y;
        setViewport((prev) => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        interactionRef.current.startScreen = screenPoint;
        return;
      }

      if (mode === "erase") {
        const hit = elements.find(
          (el) =>
            !interactionRef.current.erasedIds?.has(el.id) &&
            pointInElement(worldPoint, el)
        );
        if (hit) {
          interactionRef.current.erasedIds?.add(hit.id);
          const remaining = elements.filter(
            (el) => !interactionRef.current.erasedIds?.has(el.id)
          );
          setElements(remaining);
        }
        return;
      }

      if (mode === "drag") {
        let dx = worldPoint.x - startWorld.x;
        let dy = worldPoint.y - startWorld.y;
        const dragStarts = interactionRef.current.dragElementStarts;
        if (!dragStarts) return;

        // 1. Grid Snapping
        if (gridMode !== "none") {
          dx = snapToGrid(dx, 12);
          dy = snapToGrid(dy, 12);
        }

        // 2. Alignment Guides & Snapping against unselected elements
        const draggingElements = elements.filter((el) => dragStarts.has(el.id));
        const otherElements = elements.filter((el) => !selectedIds.has(el.id));

        if (draggingElements.length > 0 && otherElements.length > 0) {
          const rawBox = getElementsBoundingBox(draggingElements);
          if (rawBox) {
            const proposedBox: BoundingBox = {
              minX: rawBox.minX + dx,
              minY: rawBox.minY + dy,
              maxX: rawBox.maxX + dx,
              maxY: rawBox.maxY + dy,
              width: rawBox.width,
              height: rawBox.height,
            };
            const { snapX, snapY, guides } = calculateAlignmentGuides(
              proposedBox,
              otherElements,
              6
            );
            if (guides.length > 0) {
              dx = snapX - rawBox.minX;
              dy = snapY - rawBox.minY;
              setAlignmentGuides(guides);
            } else {
              setAlignmentGuides([]);
            }
          }
        } else {
          setAlignmentGuides([]);
        }

        setElements((prev) =>
          prev.map((el) => {
            const start = dragStarts.get(el.id);
            if (!start) return el;

            const updated: SketchElement = {
              ...el,
              x: Math.round(start.x + dx),
              y: Math.round(start.y + dy),
            };

            if (start.startPoint && start.endPoint) {
              updated.startPoint = {
                x: Math.round(start.startPoint.x + dx),
                y: Math.round(start.startPoint.y + dy),
              };
              updated.endPoint = {
                x: Math.round(start.endPoint.x + dx),
                y: Math.round(start.endPoint.y + dy),
              };
            }

            if (el.points) {
              updated.points = el.points.map((p, idx) => {
                const orig =
                  interactionRef.current.initialElementSnapshot?.points?.[
                    idx
                  ] || p;
                return { x: orig.x + dx, y: orig.y + dy };
              });
            }

            return updated;
          })
        );
        return;
      }

      if (mode === "marquee") {
        const minX = Math.min(startWorld.x, worldPoint.x);
        const minY = Math.min(startWorld.y, worldPoint.y);
        const maxX = Math.max(startWorld.x, worldPoint.x);
        const maxY = Math.max(startWorld.y, worldPoint.y);

        const marqueeBox: BoundingBox = {
          minX,
          minY,
          maxX,
          maxY,
          width: maxX - minX,
          height: maxY - minY,
        };
        setSelectionMarquee(marqueeBox);

        const intersectedIds = new Set<string>();
        elements.forEach((el) => {
          if (elementIntersectsBox(el, marqueeBox)) {
            intersectedIds.add(el.id);
          }
        });
        updateSelectedIds(intersectedIds);
        return;
      }

      if (mode === "draw" && currentDrawingElement) {
        if (
          currentDrawingElement.type === "PEN" ||
          currentDrawingElement.type === "HIGHLIGHTER"
        ) {
          setCurrentDrawingElement((prev) => {
            if (!prev) return null;
            const pts = prev.points || [];
            return {
              ...prev,
              points: [...pts, worldPoint],
            };
          });
        } else if (currentDrawingElement.type === "CONNECTOR") {
          setCurrentDrawingElement((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              endPoint: worldPoint,
            };
          });
        } else if (
          currentDrawingElement.type === "LINE" ||
          currentDrawingElement.type === "ARROW"
        ) {
          setCurrentDrawingElement((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              width: worldPoint.x - startWorld.x,
              height: worldPoint.y - startWorld.y,
            };
          });
        } else {
          const minX = Math.min(startWorld.x, worldPoint.x);
          const minY = Math.min(startWorld.y, worldPoint.y);
          const width = Math.max(10, Math.abs(worldPoint.x - startWorld.x));
          const height = Math.max(10, Math.abs(worldPoint.y - startWorld.y));

          setCurrentDrawingElement((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              x: minX,
              y: minY,
              width,
              height,
            };
          });
        }
        return;
      }

      // RESIZE HANDLE DRAGGING
      if (mode === "resize") {
        const handle = interactionRef.current.resizeHandle;
        const initBox = interactionRef.current.initialBox;
        const initialElements = interactionRef.current.initialElements;
        if (!handle || !initBox || !initialElements) return;

        const dx = worldPoint.x - startWorld.x;
        const dy = worldPoint.y - startWorld.y;

        let newMinX = initBox.minX;
        let newMinY = initBox.minY;
        let newMaxX = initBox.maxX;
        let newMaxY = initBox.maxY;

        if (handle.includes("l")) newMinX = Math.min(initBox.minX + dx, initBox.maxX - 10);
        if (handle.includes("r")) newMaxX = Math.max(initBox.maxX + dx, initBox.minX + 10);
        if (handle.includes("t")) newMinY = Math.min(initBox.minY + dy, initBox.maxY - 10);
        if (handle.includes("b")) newMaxY = Math.max(initBox.maxY + dy, initBox.minY + 10);

        const newWidth = Math.max(10, newMaxX - newMinX);
        const newHeight = Math.max(10, newMaxY - newMinY);
        const origWidth = Math.max(1, initBox.width);
        const origHeight = Math.max(1, initBox.height);
        const scaleX = newWidth / origWidth;
        const scaleY = newHeight / origHeight;

        const nextElements = elementsRef.current.map((el) => {
          const origEl = initialElements.find((item) => item.id === el.id);
          if (!origEl) return el;

          const elRelX = origEl.x - initBox.minX;
          const elRelY = origEl.y - initBox.minY;
          const elNewX = Math.round(newMinX + elRelX * scaleX);
          const elNewY = Math.round(newMinY + elRelY * scaleY);
          const elNewW = Math.max(10, Math.round(origEl.width * scaleX));
          const elNewH = Math.max(10, Math.round(origEl.height * scaleY));

          const updated: SketchElement = {
            ...origEl,
            x: elNewX,
            y: elNewY,
            width: elNewW,
            height: elNewH,
            updatedAt: Date.now(),
          };

          // Scale freehand points if PEN / HIGHLIGHTER
          if (origEl.points && origEl.points.length > 0) {
            updated.points = origEl.points.map((p) => ({
              x: Math.round(newMinX + (p.x - initBox.minX) * scaleX),
              y: Math.round(newMinY + (p.y - initBox.minY) * scaleY),
            }));
          }

          // Scale startPoint and endPoint if LINE / ARROW / CONNECTOR
          if (origEl.startPoint && origEl.endPoint) {
            updated.startPoint = {
              x: Math.round(newMinX + (origEl.startPoint.x - initBox.minX) * scaleX),
              y: Math.round(newMinY + (origEl.startPoint.y - initBox.minY) * scaleY),
            };
            updated.endPoint = {
              x: Math.round(newMinX + (origEl.endPoint.x - initBox.minX) * scaleX),
              y: Math.round(newMinY + (origEl.endPoint.y - initBox.minY) * scaleY),
            };
          }

          return updated;
        });

        lastResizedElementsRef.current = nextElements;
        setElements(nextElements);
        return;
      }
    },
    [viewport, elements, selectedIds, currentDrawingElement, updateSelectedIds]
  );

  const handlePointerUp = useCallback(() => {
    const { mode, erasedIds } = interactionRef.current;

    if (mode === "pan") {
      setIsPanning(false);
    } else if (mode === "erase") {
      if (erasedIds && erasedIds.size > 0) {
        commitElements(elements.filter((el) => !erasedIds.has(el.id)));
      }
    } else if (mode === "drag") {
      commitElements(elements);
    } else if (mode === "resize") {
      if (lastResizedElementsRef.current) {
        commitElements(lastResizedElementsRef.current);
        lastResizedElementsRef.current = null;
      } else {
        commitElements(elementsRef.current);
      }
    } else if (mode === "marquee") {
      setSelectionMarquee(null);
    } else if (mode === "draw" && currentDrawingElement) {
      const finalized: SketchElement = {
        ...currentDrawingElement,
        updatedAt: Date.now(),
      };

      const isValid =
        (finalized.points && finalized.points.length > 1) ||
        finalized.width > 5 ||
        finalized.height > 5 ||
        finalized.type === "CONNECTOR";

      if (isValid) {
        commitElements([...elements, finalized]);
        updateSelectedIds(new Set([finalized.id]));
      }

      setCurrentDrawingElement(null);
      if (activeTool !== "pen" && activeTool !== "highlighter") {
        setActiveTool("select");
      }
    }

    setAlignmentGuides([]);

    interactionRef.current = {
      mode: "none",
      startScreen: { x: 0, y: 0 },
      startWorld: { x: 0, y: 0 },
    };
  }, [
    elements,
    currentDrawingElement,
    activeTool,
    commitElements,
    updateSelectedIds,
  ]);

  const startResize = useCallback(
    (
      e: React.MouseEvent | React.PointerEvent,
      handle: ResizeHandle,
      containerRect: DOMRect
    ) => {
      e.stopPropagation();
      if (!canEdit) return;
      const selected = elementsRef.current.filter((el) => selectedIds.has(el.id));
      if (selected.length === 0 || selected.some((el) => el.isLocked)) return;

      const screenPoint: Point = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      };
      const worldPoint = screenToWorld(screenPoint, viewport);
      const box = getElementsBoundingBox(selected);
      if (!box) return;

      lastResizedElementsRef.current = null;
      interactionRef.current = {
        mode: "resize",
        startScreen: screenPoint,
        startWorld: worldPoint,
        resizeHandle: handle,
        initialBox: box,
        initialElements: selected.map((el) => ({ ...el })),
      };
    },
    [canEdit, selectedIds, viewport]
  );

  // Global window pointer listener to ensure drag and resize never drop during fast cursor moves
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const mode = interactionRef.current.mode;
      if (mode === "none") return;
      const container = document.querySelector(
        '[data-sketchboard-canvas="true"]'
      ) as HTMLDivElement | null;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      handlePointerMove(e as unknown as React.PointerEvent<HTMLDivElement>, rect);
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      const mode = interactionRef.current.mode;
      if (mode === "none") return;
      handlePointerUp();
    };

    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>, containerRect: DOMRect) => {
      e.preventDefault();
      const mouseScreen: Point = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      };

      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = -e.deltaY * 0.005;
        const nextZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, viewport.zoom + zoomDelta)
        );
        setViewport(zoomAroundPoint(viewport, mouseScreen, nextZoom));
      } else {
        setViewport((prev) => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    },
    [viewport]
  );

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copy();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        paste();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }

      // Lock / Unlock shortcut (Ctrl+Shift+L)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleLockSelected();
        return;
      }

      // Fit to screen shortcut (Shift+1)
      if (e.shiftKey && e.key === "1") {
        e.preventDefault();
        if (typeof window !== "undefined") {
          fitToScreen(window.innerWidth, window.innerHeight);
        }
        return;
      }

      if (e.key === "[") {
        if (e.shiftKey) sendToBack();
        else sendBackward();
        return;
      }
      if (e.key === "]") {
        if (e.shiftKey) bringToFront();
        else bringForward();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        resetZoom();
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        setActiveTool("select");
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "v" || key === "1") setActiveTool("select");
      else if (key === "h") {
        if (e.shiftKey) setActiveTool("highlighter");
        else setActiveTool("hand");
      } else if (key === "p" || key === "2") setActiveTool("pen");
      else if (key === "e") setActiveTool("eraser");
      else if (key === "r") setActiveTool("rectangle");
      else if (key === "o") setActiveTool("circle");
      else if (key === "d") setActiveTool("diamond");
      else if (key === "l") setActiveTool("line");
      else if (key === "a") setActiveTool("arrow");
      else if (key === "t") setActiveTool("text");
      else if (key === "s") setActiveTool("sticky");
      else if (key === "c") setActiveTool("connector");
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    selectAll,
    copy,
    paste,
    duplicate,
    groupSelected,
    ungroupSelected,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    deleteSelected,
    zoomIn,
    zoomOut,
    resetZoom,
    clearSelection,
    undo,
    redo,
  ]);

  // Import from JSON backup
  const importFromJson = useCallback(
    (jsonString: string) => {
      if (!canEdit) return;
      try {
        const { elements: imported, boardName: importedName } =
          parseSketchboardJson(jsonString);
        if (importedName) {
          setBoardName(importedName);
        }
        const combined = [...elements, ...imported];
        commitElements(combined);
        const newIds = new Set(imported.map((el) => el.id));
        updateSelectedIds(newIds);
      } catch (err) {
        console.error("[Sketchboard] Failed to import JSON:", err);
        throw err;
      }
    },
    [canEdit, elements, commitElements, updateSelectedIds]
  );

  return {
    // State
    boardName,
    setBoardName,
    elements,
    selectedIds,
    activeTool,
    setActiveTool,
    viewport,
    gridMode,
    setGridMode,
    canvasBg,
    setCanvasBg,
    saveStatus,
    canEdit,
    canUndo,
    canRedo,

    // Real-Time Collab & Presence
    collabStatus,
    collaborators,

    // Active tool styles
    strokeColor,
    setStrokeColor,
    fillColor,
    setFillColor,
    strokeWidth,
    setStrokeWidth,
    strokeStyle,
    setStrokeStyle,
    opacity,
    setOpacity,
    fontSize,
    setFontSize,
    textAlign,
    setTextAlign,
    textColor,
    setTextColor,

    // Ephemeral & Guides
    currentDrawingElement,
    selectionMarquee,
    alignmentGuides,
    isPanning,
    isSpacePressed,

    // Actions
    undo,
    redo,
    selectElement,
    selectAll,
    clearSelection,
    deleteSelected,
    toggleLockSelected,
    copy,
    paste,
    duplicate,
    groupSelected,
    ungroupSelected,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    align,
    distribute,
    updateSelectedProperties,
    updateElement,
    insertImage,
    importFromJson,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    fitToScreen,
    panBy,

    // Pointer events
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    startResize,
  };
}
