"use client";

import * as React from "react";
import Link from "next/link";
import {
  Layers,
  ArrowLeft,
  Trash2,
  Grid,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  CanvasNode,
  CanvasNodeType,
  CanvasPoint,
  PersistedCanvasData,
  CanvasCollaborator,
} from "@/types/canvas";
import { useCanvas } from "@/lib/canvas/use-canvas";
import { screenToWorld, worldToScreen } from "@/lib/canvas/utils";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasSelectionToolbar } from "./canvas-selection-toolbar";
import { CanvasNodeRenderer } from "./canvas-node-renderer";
import { CanvasEmptyState } from "./canvas-empty-state";
import { CanvasCollaborators, CollaboratorAvatars } from "./canvas-collaborators";

export interface CanvasWorkspaceData {
  id: string;
  name: string;
  ownerId: string;
  currentUserRole: "OWNER" | "ADMIN" | "EDITOR" | "MEMBER" | "VIEWER" | string;
  canEdit: boolean;
}

export interface CanvasUserData {
  id: string;
  name: string | null;
  email: string | null;
}

interface CanvasViewProps {
  workspace: CanvasWorkspaceData;
  user: CanvasUserData;
  initialCanvas?: PersistedCanvasData;
}

export function CanvasView({ workspace, user, initialCanvas }: CanvasViewProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const {
    nodes,
    selectedNode,
    selectedNodeId,
    editingNodeId,
    activeTool,
    viewport,
    canEdit,
    canUndo,
    canRedo,
    saveStatus,
    saveError,
    saveNow,
    reloadCanvas,
    scheduleAutosave,
    undo,
    redo,
    addNode,
    updateNode,
    moveNode,
    resizeNode,
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
    collaborators,
    collabStatus,
    updateCursor,
  } = useCanvas({
    workspaceId: workspace.id,
    canEdit: workspace.canEdit,
    authorName: user.name || "SyncSpace User",
    initialCanvas,
  });

  const [isSpacePressed, setIsSpacePressed] = React.useState(false);
  const [isPanning, setIsPanning] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);

  // Keep live viewport in ref so global move listeners don't re-bind on pan/zoom
  const viewportRef = React.useRef(viewport);
  React.useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // Dragging node state
  const dragRef = React.useRef<{
    isDragging: boolean;
    nodeId: string | null;
    startMouseWorld: CanvasPoint;
    startNodePos: CanvasPoint;
    lastPos: CanvasPoint | null;
  }>({
    isDragging: false,
    nodeId: null,
    startMouseWorld: { x: 0, y: 0 },
    startNodePos: { x: 0, y: 0 },
    lastPos: null,
  });

  // Resizing node state
  const resizeRef = React.useRef<{
    isResizing: boolean;
    nodeId: string | null;
    handle: "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w";
    startMouseWorld: CanvasPoint;
    startNodeBox: { x: number; y: number; width: number; height: number };
    lastBox: { x: number; y: number; width: number; height: number } | null;
  }>({
    isResizing: false,
    nodeId: null,
    handle: "se",
    startMouseWorld: { x: 0, y: 0 },
    startNodeBox: { x: 0, y: 0, width: 0, height: 0 },
    lastBox: null,
  });

  // Pan drag tracking state
  const panRef = React.useRef<{
    isPanning: boolean;
    startX: number;
    startY: number;
  }>({
    isPanning: false,
    startX: 0,
    startY: 0,
  });

  // Helper to get screen offset relative to canvas container
  const getContainerRelativePoint = React.useCallback(
    (clientX: number, clientY: number): CanvasPoint => {
      if (!containerRef.current) return { x: clientX, y: clientY };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  // Wheel listener for natural trackpad pan & pinch/ctrl-zoom
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const screenPoint = getContainerRelativePoint(e.clientX, e.clientY);

      if (e.ctrlKey || e.metaKey) {
        // Zooming at mouse cursor
        const zoomDelta = -e.deltaY * 0.005;
        zoomAt(screenPoint, viewport.zoom + zoomDelta);
      } else {
        // Panning canvas
        panBy(-e.deltaX, -e.deltaY);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [getContainerRelativePoint, panBy, zoomAt, viewport.zoom]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger tools or deletion if focused inside an input/textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Spacebar hold for pan
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.shiftKey && e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Zoom presets
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        resetViewport();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "1") {
        e.preventDefault();
        if (containerRef.current) {
          fitToView(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight
          );
        }
        return;
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("select");
          break;
        case "h":
          setActiveTool("hand");
          break;
        case "s":
          if (canEdit) setActiveTool("sticky");
          break;
        case "t":
          if (canEdit) setActiveTool("text");
          break;
        case "r":
          if (canEdit) setActiveTool("rectangle");
          break;
        case "o":
          if (canEdit) setActiveTool("circle");
          break;
        case "delete":
        case "backspace":
          if (canEdit && selectedNodeId) {
            e.preventDefault();
            deleteSelected();
          }
          break;
        case "escape":
          selectNode(null);
          setEditingNodeId(null);
          setActiveTool("select");
          break;
      }
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
    canEdit,
    selectedNodeId,
    deleteSelected,
    selectNode,
    setEditingNodeId,
    setActiveTool,
    undo,
    redo,
    resetViewport,
    fitToView,
  ]);

  // Pointer Down on canvas surface
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return; // Only left or middle click

    const screenPoint = getContainerRelativePoint(e.clientX, e.clientY);
    const worldPoint = screenToWorld(screenPoint, viewport);

    // If middle click or space pressed or hand tool, start pan
    if (e.button === 1 || isSpacePressed || activeTool === "hand") {
      panRef.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
      };
      setIsPanning(true);
      return;
    }

    // If creation tool is active, spawn node at click position
    if (
      canEdit &&
      (activeTool === "sticky" ||
        activeTool === "text" ||
        activeTool === "rectangle" ||
        activeTool === "circle")
    ) {
      const typeMap: Record<string, CanvasNodeType> = {
        sticky: "STICKY",
        text: "TEXT",
        rectangle: "RECTANGLE",
        circle: "CIRCLE",
      };
      const nodeType = typeMap[activeTool];
      if (nodeType) {
        addNode(nodeType, worldPoint);
      }
      return;
    }

    // Otherwise in select mode on empty canvas: deselect and initiate pan
    selectNode(null);
    setEditingNodeId(null);

    panRef.current = {
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
    };
    setIsPanning(true);
  };

  // Node Drag Initiation
  const handleStartDrag = (
    e: React.MouseEvent | React.PointerEvent,
    node: CanvasNode
  ) => {
    if (!canEdit || activeTool === "hand" || isSpacePressed) return;
    const screenPoint = getContainerRelativePoint(e.clientX, e.clientY);
    const worldPoint = screenToWorld(screenPoint, viewportRef.current);

    dragRef.current = {
      isDragging: true,
      nodeId: node.id,
      startMouseWorld: worldPoint,
      startNodePos: { x: node.x, y: node.y },
      lastPos: { x: node.x, y: node.y },
    };
  };

  // Node Resize Initiation
  const handleStartResize = (
    e: React.MouseEvent | React.PointerEvent,
    node: CanvasNode,
    handle: "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w"
  ) => {
    if (!canEdit) return;
    const screenPoint = getContainerRelativePoint(e.clientX, e.clientY);
    const worldPoint = screenToWorld(screenPoint, viewportRef.current);

    resizeRef.current = {
      isResizing: true,
      nodeId: node.id,
      handle,
      startMouseWorld: worldPoint,
      startNodeBox: {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      },
      lastBox: {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      },
    };
  };

  // Throttled cursor position broadcaster to keep network traffic minimal
  const lastCursorSendRef = React.useRef<number>(0);
  const cursorRafRef = React.useRef<number | null>(null);
  const pendingCursorRef = React.useRef<CanvasPoint | null>(null);
  const lastSentCursorPointRef = React.useRef<CanvasPoint | null>(null);

  const sendThrottledCursor = React.useCallback(
    (point: CanvasPoint | null) => {
      if (point === null) {
        if (cursorRafRef.current) {
          cancelAnimationFrame(cursorRafRef.current);
          cursorRafRef.current = null;
        }
        pendingCursorRef.current = null;
        lastSentCursorPointRef.current = null;
        updateCursor(null);
        lastCursorSendRef.current = Date.now();
        return;
      }

      // Suppress micro-jitter (< 1.5px delta) to reduce network chatter
      if (lastSentCursorPointRef.current) {
        const dx = point.x - lastSentCursorPointRef.current.x;
        const dy = point.y - lastSentCursorPointRef.current.y;
        if (dx * dx + dy * dy < 2.25) {
          return;
        }
      }

      pendingCursorRef.current = point;
      const now = Date.now();
      const elapsed = now - lastCursorSendRef.current;

      // Throttle to max ~30 updates per second (~33ms) to preserve responsiveness without flooding WebSocket
      if (elapsed >= 33) {
        lastCursorSendRef.current = now;
        lastSentCursorPointRef.current = point;
        updateCursor(point);
      } else if (!cursorRafRef.current) {
        cursorRafRef.current = requestAnimationFrame(() => {
          cursorRafRef.current = null;
          if (pendingCursorRef.current) {
            lastCursorSendRef.current = Date.now();
            lastSentCursorPointRef.current = pendingCursorRef.current;
            updateCursor(pendingCursorRef.current);
          }
        });
      }
    },
    [updateCursor]
  );

  // Clear cursor when tab switches or window loses focus
  React.useEffect(() => {
    const handleBlur = () => sendThrottledCursor(null);
    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendThrottledCursor(null);
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (cursorRafRef.current) {
        cancelAnimationFrame(cursorRafRef.current);
      }
    };
  }, [sendThrottledCursor]);

  // Pointer Move (global listener)
  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // Live World-Space Cursor Tracking
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isInside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        if (isInside) {
          const screenPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
          const currentWorld = screenToWorld(screenPoint, viewportRef.current);
          sendThrottledCursor(currentWorld);
        } else {
          sendThrottledCursor(null);
        }
      }

      // 1. Resizing node
      if (resizeRef.current.isResizing && resizeRef.current.nodeId) {
        const screenPoint = getContainerRelativePoint(e.clientX, e.clientY);
        const currentWorld = screenToWorld(screenPoint, viewportRef.current);
        const { handle, startMouseWorld, startNodeBox, nodeId } = resizeRef.current;
        const dx = currentWorld.x - startMouseWorld.x;
        const dy = currentWorld.y - startMouseWorld.y;

        const minW = 60;
        const minH = 40;

        let newW = startNodeBox.width;
        let newH = startNodeBox.height;
        let newX = startNodeBox.x;
        let newY = startNodeBox.y;

        if (handle === "se") {
          newW = Math.max(minW, Math.round(startNodeBox.width + dx));
          newH = Math.max(minH, Math.round(startNodeBox.height + dy));
          newX = startNodeBox.x;
          newY = startNodeBox.y;
        } else if (handle === "sw") {
          const targetW = Math.round(startNodeBox.width - dx);
          newW = Math.max(minW, targetW);
          newX = startNodeBox.x + (startNodeBox.width - newW);
          newH = Math.max(minH, Math.round(startNodeBox.height + dy));
          newY = startNodeBox.y;
        } else if (handle === "ne") {
          newW = Math.max(minW, Math.round(startNodeBox.width + dx));
          newX = startNodeBox.x;
          const targetH = Math.round(startNodeBox.height - dy);
          newH = Math.max(minH, targetH);
          newY = startNodeBox.y + (startNodeBox.height - newH);
        } else if (handle === "nw") {
          const targetW = Math.round(startNodeBox.width - dx);
          newW = Math.max(minW, targetW);
          newX = startNodeBox.x + (startNodeBox.width - newW);
          const targetH = Math.round(startNodeBox.height - dy);
          newH = Math.max(minH, targetH);
          newY = startNodeBox.y + (startNodeBox.height - newH);
        } else if (handle === "e") {
          newW = Math.max(minW, Math.round(startNodeBox.width + dx));
        } else if (handle === "w") {
          const targetW = Math.round(startNodeBox.width - dx);
          newW = Math.max(minW, targetW);
          newX = startNodeBox.x + (startNodeBox.width - newW);
        } else if (handle === "s") {
          newH = Math.max(minH, Math.round(startNodeBox.height + dy));
        } else if (handle === "n") {
          const targetH = Math.round(startNodeBox.height - dy);
          newH = Math.max(minH, targetH);
          newY = startNodeBox.y + (startNodeBox.height - newH);
        }

        resizeRef.current.lastBox = { width: newW, height: newH, x: newX, y: newY };
        resizeNode(nodeId, newW, newH, newX, newY);
        return;
      }

      // 2. Dragging node
      if (dragRef.current.isDragging && dragRef.current.nodeId) {
        const screenPoint = getContainerRelativePoint(e.clientX, e.clientY);
        const currentWorld = screenToWorld(screenPoint, viewportRef.current);
        const dx = currentWorld.x - dragRef.current.startMouseWorld.x;
        const dy = currentWorld.y - dragRef.current.startMouseWorld.y;

        const newX = Math.round(dragRef.current.startNodePos.x + dx);
        const newY = Math.round(dragRef.current.startNodePos.y + dy);

        dragRef.current.lastPos = { x: newX, y: newY };
        moveNode(dragRef.current.nodeId, newX, newY);
        return;
      }

      // 3. Panning canvas
      if (panRef.current.isPanning) {
        const dx = e.clientX - panRef.current.startX;
        const dy = e.clientY - panRef.current.startY;
        panRef.current.startX = e.clientX;
        panRef.current.startY = e.clientY;
        panBy(dx, dy);
      }
    };

    const handlePointerUp = () => {
      if (resizeRef.current.isResizing && resizeRef.current.nodeId) {
        const nodeId = resizeRef.current.nodeId;
        const finalBox = resizeRef.current.lastBox;
        if (finalBox) {
          updateNode(nodeId, {
            width: finalBox.width,
            height: finalBox.height,
            x: finalBox.x,
            y: finalBox.y,
          });
        }
        resizeRef.current.isResizing = false;
        resizeRef.current.nodeId = null;
        resizeRef.current.lastBox = null;
      }

      if (dragRef.current.isDragging && dragRef.current.nodeId) {
        const nodeId = dragRef.current.nodeId;
        const finalPos = dragRef.current.lastPos;
        if (finalPos) {
          updateNode(nodeId, { x: finalPos.x, y: finalPos.y });
        }
        dragRef.current.isDragging = false;
        dragRef.current.nodeId = null;
        dragRef.current.lastPos = null;
      }

      if (panRef.current.isPanning) {
        panRef.current.isPanning = false;
        setIsPanning(false);
        scheduleAutosave();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    viewport,
    getContainerRelativePoint,
    resizeNode,
    moveNode,
    updateNode,
    panBy,
    scheduleAutosave,
    sendThrottledCursor,
  ]);

  // Quick Add from Empty State or Toolbar
  const handleQuickAdd = (type: CanvasNodeType) => {
    if (!canEdit) return;
    const container = containerRef.current;
    const centerPoint: CanvasPoint = container
      ? { x: container.clientWidth / 2, y: container.clientHeight / 2 }
      : { x: 400, y: 300 };
    const worldPoint = screenToWorld(centerPoint, viewport);
    addNode(type, {
      x: worldPoint.x - 100,
      y: worldPoint.y - 70,
    });
  };

  // Cursor style based on current interaction mode
  const getCursorClass = () => {
    if (isPanning) return "cursor-grabbing";
    if (isSpacePressed || activeTool === "hand") return "cursor-grab";
    if (
      activeTool === "sticky" ||
      activeTool === "text" ||
      activeTool === "rectangle" ||
      activeTool === "circle"
    ) {
      return "cursor-crosshair";
    }
    return "cursor-default";
  };

  // Calculate screen position for contextual selection toolbar
  const selectionScreenPos = React.useMemo(() => {
    if (!selectedNode) return null;
    return worldToScreen(
      {
        x: selectedNode.x + selectedNode.width / 2,
        y: selectedNode.y,
      },
      viewport
    );
  }, [selectedNode, viewport]);

  // Pre-index collaborator selections by node id for O(1) lookups
  const collaboratorsByNode = React.useMemo(() => {
    const map = new Map<string, CanvasCollaborator[]>();
    for (const c of collaborators) {
      if (c.selectedNodeId) {
        const list = map.get(c.selectedNodeId) || [];
        list.push(c);
        map.set(c.selectedNodeId, list);
      }
    }
    return map;
  }, [collaborators]);

  const handleEndEditing = React.useCallback(() => {
    setEditingNodeId(null);
  }, [setEditingNodeId]);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#fbfbfa] dark:bg-white">
      {/* Top Navbar Header */}
      <header className="h-14 border-b border-slate-200/90 dark:border-slate-200 bg-white/90 dark:bg-white/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30 select-none">
        {/* Left: Branding & Workspace Navigation */}
        <div className="flex items-center gap-3">
          <Link
            href={`/workspaces/${workspace.id}`}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors p-1 rounded-lg hover:bg-slate-100"
            title="Return to Workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="h-4 w-px bg-slate-200" />

          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-500 p-0.5 shadow-2xs flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-[6px] flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
              </div>
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900 hidden sm:inline">
              SyncSpace
            </span>
          </Link>

          <span className="text-slate-300">/</span>

          <Link
            href={`/workspaces/${workspace.id}`}
            className="text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors truncate max-w-[150px] sm:max-w-[200px]"
          >
            {workspace.name}
          </Link>

          <Badge variant="brand" size="sm" className="font-mono text-[10px] py-0 px-1.5">
            Spatial Canvas
          </Badge>

          {!canEdit && (
            <Badge variant="warning" size="sm" className="text-[10px] py-0 px-1.5">
              Read Only
            </Badge>
          )}
        </div>

        {/* Right: Actions, Grid Toggle, and User Info */}
        <div className="flex items-center gap-2">
          {/* Autosave and Persistence Status Badge */}
          {canEdit && (
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-xs text-sky-600 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </span>
              )}

              {saveStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Saved</span>
                </span>
              )}

              {saveStatus === "unsaved" && (
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="hidden sm:inline">Unsaved</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => saveNow()}
                    className="text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                    title="Save changes to server now"
                  >
                    Save
                  </button>
                </div>
              )}

              {saveStatus === "error" && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[120px]" title={saveError || "Save failed"}>
                    Save error
                  </span>
                  <button
                    type="button"
                    onClick={() => saveNow()}
                    className="font-semibold underline hover:text-rose-900"
                  >
                    Retry
                  </button>
                </div>
              )}

              {saveStatus === "conflict" && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="hidden sm:inline font-medium">Out of sync</span>
                  <button
                    type="button"
                    onClick={() => reloadCanvas()}
                    className="font-semibold underline hover:text-amber-950"
                  >
                    Reload
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Real-Time Live Sync Indicator */}
          {collabStatus === "connected" && (
            <span
              className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium pl-1"
              title="Real-time live collaboration connected"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden md:inline">Live</span>
            </span>
          )}
          {collabStatus === "connecting" && (
            <span
              className="flex items-center gap-1.5 text-xs text-sky-600 font-medium pl-1"
              title="Connecting to collaboration server..."
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden md:inline">Connecting</span>
            </span>
          )}
          {collabStatus === "disconnected" && (
            <span
              className="flex items-center gap-1.5 text-xs text-slate-400 font-medium pl-1"
              title="Operating in offline database persistence mode"
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="hidden md:inline">Local DB</span>
            </span>
          )}

          {/* Active Collaborators Avatars & Presence */}
          <CollaboratorAvatars
            collaborators={collaborators}
            currentUserName={user.name || "You"}
            currentUserRole={workspace.currentUserRole}
          />

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Toggle Grid */}
          <button
            type="button"
            onClick={() => setShowGrid((prev) => !prev)}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              showGrid
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            }`}
            title="Toggle Background Grid"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Clear Canvas (if nodes exist and user can edit) */}
          {canEdit && nodes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to clear all canvas objects? You can undo this action.")) {
                  clearCanvas();
                }
              }}
              className="text-slate-500 hover:text-rose-600 text-xs h-8 px-2"
              title="Clear Canvas"
            >
              <Trash2 className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-50" />

          {/* Theme Toggle */}
          <ThemeToggle />

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-50" />

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-1">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center">
              {initials}
            </div>
            <LogoutButton variant="ghost" className="text-xs py-1 px-2 h-7" />
          </div>
        </div>
      </header>

      {/* Main Interactive Canvas Surface Area */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => sendThrottledCursor(null)}
        className={`relative flex-1 w-full h-full overflow-hidden select-none ${getCursorClass()} ${
          showGrid ? "bg-dot-pattern" : "bg-[#fbfbfa] dark:bg-white"
        }`}
        style={{
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          backgroundSize: `${Math.max(12, 24 * viewport.zoom)}px ${Math.max(12, 24 * viewport.zoom)}px`,
        }}
      >
        {/* Infinite Canvas Scaled & Translated Layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Nodes Layer */}
          <div className="relative w-full h-full pointer-events-auto">
            {nodes.map((node) => {
              const selectedBy = collaboratorsByNode.get(node.id);
              return (
                <CanvasNodeRenderer
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  isEditing={editingNodeId === node.id}
                  canEdit={canEdit}
                  selectedBy={selectedBy}
                  onSelect={(e) => {
                    e.stopPropagation();
                    selectNode(node.id);
                  }}
                  onStartDrag={handleStartDrag}
                  onStartResize={handleStartResize}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (canEdit) {
                      selectNode(node.id);
                      setEditingNodeId(node.id);
                    }
                  }}
                  onContentChange={(content) => {
                    updateNode(node.id, { content });
                    scheduleAutosave();
                  }}
                  onEndEditing={handleEndEditing}
                />
              );
            })}
          </div>
        </div>

        {/* Remote Collaborators Cursors Layer */}
        <CanvasCollaborators collaborators={collaborators} viewport={viewport} />

        {/* Contextual Floating Selection Toolbar (Over Selected Node) */}
        {selectedNode && selectionScreenPos && !editingNodeId && (
          <CanvasSelectionToolbar
            node={selectedNode}
            onUpdateColor={(colorId) => updateNode(selectedNode.id, { colorId })}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onBringForward={() => bringForward(selectedNode.id)}
            onSendBackward={() => sendBackward(selectedNode.id)}
            onDeselect={() => selectNode(null)}
            canEdit={canEdit}
            screenPos={selectionScreenPos}
          />
        )}

        {/* Empty State Overlay */}
        {nodes.length === 0 && (
          <CanvasEmptyState canEdit={canEdit} onAddNode={handleQuickAdd} />
        )}

        {/* Floating Bottom Toolbar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
          <CanvasToolbar
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            zoom={viewport.zoom}
            onZoomIn={() => zoomIn()}
            onZoomOut={() => zoomOut()}
            onResetZoom={resetViewport}
            onFitToView={() => {
              if (containerRef.current) {
                fitToView(
                  containerRef.current.clientWidth,
                  containerRef.current.clientHeight
                );
              }
            }}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}
