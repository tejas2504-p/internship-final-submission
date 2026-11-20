"use client";

import * as React from "react";
import { CanvasNode, CanvasCollaborator } from "@/types/canvas";
import { getColorPreset } from "@/lib/canvas/utils";

interface CanvasNodeRendererProps {
  node: CanvasNode;
  isSelected: boolean;
  isEditing: boolean;
  canEdit: boolean;
  selectedBy?: CanvasCollaborator[];
  onSelect: (e: React.MouseEvent | React.PointerEvent) => void;
  onStartDrag: (
    e: React.MouseEvent | React.PointerEvent,
    node: CanvasNode
  ) => void;
  onStartResize: (
    e: React.MouseEvent | React.PointerEvent,
    node: CanvasNode,
    handle: "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w"
  ) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContentChange: (content: string) => void;
  onEndEditing: () => void;
}

function CanvasNodeRendererComponent({
  node,
  isSelected,
  isEditing,
  canEdit,
  selectedBy,
  onSelect,
  onStartDrag,
  onStartResize,
  onDoubleClick,
  onContentChange,
  onEndEditing,
}: CanvasNodeRendererProps) {
  const colorPreset = getColorPreset(node.colorId);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const remoteSelector = !isSelected && selectedBy && selectedBy.length > 0 ? selectedBy[0] : null;

  // Auto-focus and auto-select textarea when editing begins
  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing) return; // Allow normal text selection in editing mode
    e.stopPropagation();
    onSelect(e);
    if (canEdit && e.button === 0) {
      onStartDrag(e, node);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return; // Allow normal text selection in editing mode
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onEndEditing();
    }
  };

  // Render node shape/type
  const renderContent = () => {
    switch (node.type) {
      case "STICKY":
        return (
          <div
            className={`w-full h-full p-4 rounded-2xl border shadow-md flex flex-col justify-between transition-shadow select-none ${
              colorPreset.bgClass
            } ${colorPreset.borderClass} ${colorPreset.textClass} ${
              isSelected ? "shadow-lg shadow-indigo-500/10" : ""
            }`}
            style={{
              transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
            }}
          >
            {/* Sticky Header / Author Attribution */}
            <div className="flex items-center justify-between text-[10px] font-semibold opacity-70 mb-2 border-b border-black/5 pb-1">
              <span className="truncate max-w-[120px]">
                {node.authorName || "Sticky Note"}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-mono">
                Sticky
              </span>
            </div>

            {/* Sticky Body */}
            <div className="flex-1 overflow-hidden">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={node.content}
                  onChange={(e) => onContentChange(e.target.value)}
                  onBlur={onEndEditing}
                  onKeyDown={handleKeyDown}
                  className="w-full h-full bg-transparent resize-none border-none outline-none text-xs leading-relaxed font-medium p-0 focus:ring-0"
                  placeholder="Type note content..."
                />
              ) : (
                <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap break-words">
                  {node.content || "Double-click to write note..."}
                </p>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="mt-2 pt-1.5 border-t border-black/5 flex items-center justify-between text-[9px] font-medium opacity-60">
              <span>SyncSpace Canvas</span>
              <span>Pinned</span>
            </div>
          </div>
        );

      case "RECTANGLE":
        return (
          <div
            className={`w-full h-full rounded-2xl border-2 flex items-center justify-center p-3 text-center transition-all select-none ${
              colorPreset.bgClass
            } ${colorPreset.borderClass} ${colorPreset.textClass} ${
              isSelected ? "shadow-md" : "shadow-xs"
            }`}
          >
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={node.content}
                onChange={(e) => onContentChange(e.target.value)}
                onBlur={onEndEditing}
                onKeyDown={handleKeyDown}
                className="w-full h-full bg-transparent resize-none border-none outline-none text-xs text-center font-semibold p-0 focus:ring-0"
                placeholder="Label..."
              />
            ) : (
              <span className="text-xs font-semibold break-words max-w-full">
                {node.content || "Rectangle"}
              </span>
            )}
          </div>
        );

      case "CIRCLE":
        return (
          <div
            className={`w-full h-full rounded-full border-2 flex items-center justify-center p-4 text-center select-none ${
              colorPreset.bgClass
            } ${colorPreset.borderClass} ${colorPreset.textClass} ${
              isSelected ? "shadow-md" : "shadow-xs"
            }`}
          >
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={node.content}
                onChange={(e) => onContentChange(e.target.value)}
                onBlur={onEndEditing}
                onKeyDown={handleKeyDown}
                className="w-full h-full bg-transparent resize-none border-none outline-none text-xs text-center font-semibold p-2 focus:ring-0"
                placeholder="Label..."
              />
            ) : (
              <span className="text-xs font-semibold break-words max-w-full">
                {node.content || "Circle"}
              </span>
            )}
          </div>
        );

      case "TEXT":
        return (
          <div className="w-full h-full p-2 flex items-center select-none">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={node.content}
                onChange={(e) => onContentChange(e.target.value)}
                onBlur={onEndEditing}
                onKeyDown={handleKeyDown}
                style={{ fontSize: `${node.fontSize || 16}px` }}
                className="w-full h-full bg-white/95 dark:bg-slate-50 rounded-lg p-2 border border-indigo-400 resize-none outline-none font-semibold text-slate-900 dark:text-slate-900 leading-normal"
                placeholder="Type text..."
              />
            ) : (
              <div
                style={{ fontSize: `${node.fontSize || 16}px` }}
                className="text-slate-900 dark:text-slate-900 font-semibold leading-normal break-words whitespace-pre-wrap max-w-full"
              >
                {node.content || "Double-click to edit text"}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="w-full h-full p-3 rounded-xl border border-slate-300 dark:border-slate-200 bg-white dark:bg-slate-50 text-slate-900 dark:text-slate-900 shadow-xs">
            {node.content}
          </div>
        );
    }
  };

  return (
    <div
      id={`canvas-node-${node.id}`}
      data-node-id={node.id}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (canEdit) onDoubleClick(e);
      }}
      className={`absolute cursor-pointer ${
        isSelected ? "ring-2 ring-indigo-600 ring-offset-2 z-40" : ""
      }`}
      style={{
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`,
        height: `${node.height}px`,
        zIndex: isSelected ? 9999 : node.zIndex,
        outline: remoteSelector ? `2px solid ${remoteSelector.color}` : undefined,
        outlineOffset: remoteSelector ? "2px" : undefined,
      }}
    >
      {/* Remote Collaborators Selection Badge */}
      {remoteSelector && (
        <div className="absolute -top-5 left-0 flex items-center gap-1 z-50 pointer-events-none select-none">
          {selectedBy!.map((collab) => (
            <span
              key={collab.clientId}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white shadow-xs whitespace-nowrap"
              style={{ backgroundColor: collab.color }}
            >
              {collab.userName}
            </span>
          ))}
        </div>
      )}

      {renderContent()}

      {/* Resize handles when selected and editable (8 corners & edges) */}
      {isSelected && canEdit && !isEditing && (
        <>
          {/* Top Left NW */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, node, "nw");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-xs cursor-nwse-resize z-50 hover:scale-125"
            title="Resize"
          />
          {/* Top Center N */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, node, "n");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-xs cursor-ns-resize z-50 hover:scale-125"
            title="Resize Height"
          />
          {/* Top Right NE */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, node, "ne");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-xs cursor-nesw-resize z-50 hover:scale-125"
            title="Resize"
          />
          {/* Middle Right E */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, node, "e");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-xs cursor-ew-resize z-50 hover:scale-125"
            title="Resize Width"
          />
          {/* Bottom Right SE */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, node, "se");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-xs cursor-nwse-resize z-50 hover:scale-125"
            title="Resize"
          />
          {/* Bottom Center S */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, node, "s");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-xs cursor-ns-resize z-50 hover:scale-125"
            title="Resize Height"
          />
          {/* Bottom Left SW */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, node, "sw");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-xs cursor-nesw-resize z-50 hover:scale-125"
            title="Resize"
          />
          {/* Middle Left W */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, node, "w");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-xs cursor-ew-resize z-50 hover:scale-125"
            title="Resize Width"
          />
        </>
      )}
    </div>
  );
}

function areNodePropsEqual(
  prev: CanvasNodeRendererProps,
  next: CanvasNodeRendererProps
): boolean {
  if (
    prev.isSelected !== next.isSelected ||
    prev.isEditing !== next.isEditing ||
    prev.canEdit !== next.canEdit
  ) {
    return false;
  }

  // Node object equality
  if (prev.node !== next.node) {
    if (
      prev.node.id !== next.node.id ||
      prev.node.x !== next.node.x ||
      prev.node.y !== next.node.y ||
      prev.node.width !== next.node.width ||
      prev.node.height !== next.node.height ||
      prev.node.content !== next.node.content ||
      prev.node.colorId !== next.node.colorId ||
      prev.node.type !== next.node.type ||
      prev.node.zIndex !== next.node.zIndex ||
      prev.node.rotation !== next.node.rotation
    ) {
      return false;
    }
  }

  // Remote collaborator selections
  const prevSelectors = prev.selectedBy?.length || 0;
  const nextSelectors = next.selectedBy?.length || 0;
  if (prevSelectors !== nextSelectors) {
    return false;
  }

  return true;
}

export const CanvasNodeRenderer = React.memo(
  CanvasNodeRendererComponent,
  areNodePropsEqual
);

