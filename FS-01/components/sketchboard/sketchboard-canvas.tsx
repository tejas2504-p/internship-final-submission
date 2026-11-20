"use client";

import React, { useRef } from "react";
import {
  SketchElement,
  SketchboardViewport,
  BoundingBox,
  ResizeHandle,
  GridMode,
  CanvasBgTheme,
  SketchboardCollaborator,
  AlignmentGuide,
} from "@/types/sketchboard";
import { pointsToSvgPath, getElementsBoundingBox } from "@/lib/sketchboard/utils";

interface SketchboardCanvasProps {
  elements: SketchElement[];
  selectedIds: Set<string>;
  viewport: SketchboardViewport;
  gridMode: GridMode;
  canvasBg: CanvasBgTheme;
  currentDrawingElement: SketchElement | null;
  selectionMarquee: BoundingBox | null;
  alignmentGuides?: AlignmentGuide[];
  isPanning: boolean;
  canEdit?: boolean;
  collaborators?: SketchboardCollaborator[];
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, rect: DOMRect) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>, rect: DOMRect) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>, rect: DOMRect) => void;
  onStartResize: (
    e: React.PointerEvent | React.MouseEvent,
    handle: ResizeHandle,
    rect: DOMRect
  ) => void;
  onUpdateElement: (id: string, patch: Partial<SketchElement>) => void;
  onSelectElement: (id: string, isShift?: boolean) => void;
}

export function SketchboardCanvas({
  elements,
  selectedIds,
  viewport,
  gridMode,
  canvasBg,
  currentDrawingElement,
  selectionMarquee,
  alignmentGuides = [],
  isPanning,
  collaborators = [],
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  onStartResize,
  onUpdateElement,
  onSelectElement,
}: SketchboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Background styling
  const getBgClass = () => {
    switch (canvasBg) {
      case "cream":
        return "bg-[#fafaf9]";
      case "slate":
        return "bg-[#f8fafc]";
      case "dark":
        return "bg-[#0f172a]";
      case "white":
      default:
        return "bg-white";
    }
  };

  const getGridStroke = () => {
    if (canvasBg === "dark") return "#334155";
    return "#e2e8f0";
  };

  // Compute selection bounding box & handles
  const selectedElements = elements.filter((el) => selectedIds.has(el.id));
  const selectionBox = getElementsBoundingBox(selectedElements);
  const isAnyLocked = selectedElements.some((el) => el.isLocked);

  const visualSize = Math.max(7, Math.min(12, 8 / viewport.zoom));
  const hitSize = Math.max(18, 22 / viewport.zoom);
  const halfVis = visualSize / 2;
  const halfHit = hitSize / 2;

  const resizeHandleList: { handle: ResizeHandle; cx: number; cy: number; cursor: string }[] =
    selectionBox && !isAnyLocked
      ? [
          { handle: "tl" as ResizeHandle, cx: selectionBox.minX, cy: selectionBox.minY, cursor: "nwse-resize" },
          { handle: "tc" as ResizeHandle, cx: selectionBox.minX + selectionBox.width / 2, cy: selectionBox.minY, cursor: "ns-resize" },
          { handle: "tr" as ResizeHandle, cx: selectionBox.maxX, cy: selectionBox.minY, cursor: "nesw-resize" },
          { handle: "mr" as ResizeHandle, cx: selectionBox.maxX, cy: selectionBox.minY + selectionBox.height / 2, cursor: "ew-resize" },
          { handle: "br" as ResizeHandle, cx: selectionBox.maxX, cy: selectionBox.maxY, cursor: "nwse-resize" },
          { handle: "bc" as ResizeHandle, cx: selectionBox.minX + selectionBox.width / 2, cy: selectionBox.maxY, cursor: "ns-resize" },
          { handle: "bl" as ResizeHandle, cx: selectionBox.minX, cy: selectionBox.maxY, cursor: "nesw-resize" },
          { handle: "ml" as ResizeHandle, cx: selectionBox.minX, cy: selectionBox.minY + selectionBox.height / 2, cursor: "ew-resize" },
        ]
      : [];

  // Pointer event forwarders
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    onPointerDown(e, rect);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    onPointerMove(e, rect);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    onWheel(e, rect);
  };

  const handleResizeHandlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget as SVGElement;
    const handle = target.getAttribute("data-handle") as ResizeHandle | null;
    if (!handle || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    onStartResize(e, handle, rect);
  };

  const renderStrokeStyle = (style: string, width: number) => {
    if (style === "dashed") return `${width * 3} ${width * 2}`;
    if (style === "dotted") return `${width} ${width * 2}`;
    return undefined;
  };

  return (
    <div
      ref={containerRef}
      data-sketchboard-canvas="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={onPointerUp}
      onWheel={handleWheel}
      className={`relative w-full h-full overflow-hidden select-none touch-none ${getBgClass()} ${
        isPanning ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      }`}
    >
      {/* Background SVG Grid Pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          {/* Dots Pattern */}
          <pattern
            id="sketchboard-dots"
            x={viewport.x % (24 * viewport.zoom)}
            y={viewport.y % (24 * viewport.zoom)}
            width={24 * viewport.zoom}
            height={24 * viewport.zoom}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={1}
              cy={1}
              r={1 * Math.min(viewport.zoom, 1.5)}
              fill={getGridStroke()}
            />
          </pattern>

          {/* Grid Lines Pattern */}
          <pattern
            id="sketchboard-grid"
            x={viewport.x % (24 * viewport.zoom)}
            y={viewport.y % (24 * viewport.zoom)}
            width={24 * viewport.zoom}
            height={24 * viewport.zoom}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${24 * viewport.zoom} 0 L 0 0 0 ${24 * viewport.zoom}`}
              fill="none"
              stroke={getGridStroke()}
              strokeWidth={0.75}
            />
          </pattern>

          {/* Arrowhead markers */}
          <marker
            id="arrowhead"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284c7" />
          </marker>
        </defs>

        {gridMode === "dots" && (
          <rect width="100%" height="100%" fill="url(#sketchboard-dots)" />
        )}
        {gridMode === "grid" && (
          <rect width="100%" height="100%" fill="url(#sketchboard-grid)" />
        )}
      </svg>

      {/* Main Vector Layer (Pen, Shapes, Connectors) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <g>
          {elements.map((el) => {
            const strokeDasharray = renderStrokeStyle(el.strokeStyle, el.strokeWidth);

            // PEN & HIGHLIGHTER
            if (el.type === "PEN" || el.type === "HIGHLIGHTER") {
              const d = pointsToSvgPath(el.points || []);
              return (
                <path
                  key={el.id}
                  d={d}
                  fill="none"
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={el.opacity}
                  strokeDasharray={strokeDasharray}
                />
              );
            }

            // RECTANGLE
            if (el.type === "RECTANGLE") {
              return (
                <rect
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  rx={8}
                  ry={8}
                  fill={el.fillColor}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={el.opacity}
                />
              );
            }

            // CIRCLE & ELLIPSE
            if (el.type === "CIRCLE" || el.type === "ELLIPSE") {
              return (
                <ellipse
                  key={el.id}
                  cx={el.x + el.width / 2}
                  cy={el.y + el.height / 2}
                  rx={el.width / 2}
                  ry={el.height / 2}
                  fill={el.fillColor}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={el.opacity}
                />
              );
            }

            // DIAMOND
            if (el.type === "DIAMOND") {
              const cx = el.x + el.width / 2;
              const cy = el.y + el.height / 2;
              const points = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;
              return (
                <polygon
                  key={el.id}
                  points={points}
                  fill={el.fillColor}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={el.opacity}
                />
              );
            }

            // POLYGON (TRIANGLE)
            if (el.type === "POLYGON") {
              const p1 = `${el.x + el.width / 2},${el.y}`;
              const p2 = `${el.x + el.width},${el.y + el.height}`;
              const p3 = `${el.x},${el.y + el.height}`;
              return (
                <polygon
                  key={el.id}
                  points={`${p1} ${p2} ${p3}`}
                  fill={el.fillColor}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={el.opacity}
                />
              );
            }

            // LINE
            if (el.type === "LINE") {
              return (
                <line
                  key={el.id}
                  x1={el.x}
                  y1={el.y}
                  x2={el.x + el.width}
                  y2={el.y + el.height}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  opacity={el.opacity}
                />
              );
            }

            // ARROW
            if (el.type === "ARROW") {
              return (
                <line
                  key={el.id}
                  x1={el.x}
                  y1={el.y}
                  x2={el.x + el.width}
                  y2={el.y + el.height}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  markerEnd="url(#arrowhead)"
                  opacity={el.opacity}
                />
              );
            }

            // CONNECTOR
            if (el.type === "CONNECTOR" && el.startPoint && el.endPoint) {
              return (
                <line
                  key={el.id}
                  x1={el.startPoint.x}
                  y1={el.startPoint.y}
                  x2={el.endPoint.x}
                  y2={el.endPoint.y}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  markerEnd={el.arrowEnd ? "url(#arrowhead)" : undefined}
                  opacity={el.opacity}
                />
              );
            }

            return null;
          })}

          {/* Live Drawing Preview */}
          {currentDrawingElement && (
            <g>
              {(currentDrawingElement.type === "PEN" || currentDrawingElement.type === "HIGHLIGHTER") && (
                <path
                  d={pointsToSvgPath(currentDrawingElement.points || [])}
                  fill="none"
                  stroke={currentDrawingElement.strokeColor}
                  strokeWidth={currentDrawingElement.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={currentDrawingElement.opacity}
                />
              )}
              {currentDrawingElement.type === "RECTANGLE" && (
                <rect
                  x={currentDrawingElement.x}
                  y={currentDrawingElement.y}
                  width={currentDrawingElement.width}
                  height={currentDrawingElement.height}
                  rx={8}
                  ry={8}
                  fill={currentDrawingElement.fillColor}
                  stroke={currentDrawingElement.strokeColor}
                  strokeWidth={currentDrawingElement.strokeWidth}
                  opacity={0.8}
                />
              )}
              {currentDrawingElement.type === "CIRCLE" && (
                <ellipse
                  cx={currentDrawingElement.x + currentDrawingElement.width / 2}
                  cy={currentDrawingElement.y + currentDrawingElement.height / 2}
                  rx={currentDrawingElement.width / 2}
                  ry={currentDrawingElement.height / 2}
                  fill={currentDrawingElement.fillColor}
                  stroke={currentDrawingElement.strokeColor}
                  strokeWidth={currentDrawingElement.strokeWidth}
                  opacity={0.8}
                />
              )}
              {currentDrawingElement.type === "CONNECTOR" && currentDrawingElement.startPoint && currentDrawingElement.endPoint && (
                <line
                  x1={currentDrawingElement.startPoint.x}
                  y1={currentDrawingElement.startPoint.y}
                  x2={currentDrawingElement.endPoint.x}
                  y2={currentDrawingElement.endPoint.y}
                  stroke={currentDrawingElement.strokeColor}
                  strokeWidth={currentDrawingElement.strokeWidth}
                  markerEnd="url(#arrowhead)"
                  opacity={0.8}
                />
              )}
              {(currentDrawingElement.type === "LINE" || currentDrawingElement.type === "ARROW") && (
                <line
                  x1={currentDrawingElement.x}
                  y1={currentDrawingElement.y}
                  x2={currentDrawingElement.x + currentDrawingElement.width}
                  y2={currentDrawingElement.y + currentDrawingElement.height}
                  stroke={currentDrawingElement.strokeColor}
                  strokeWidth={currentDrawingElement.strokeWidth}
                  markerEnd={currentDrawingElement.type === "ARROW" ? "url(#arrowhead)" : undefined}
                  opacity={0.8}
                />
              )}
            </g>
          )}

          {/* Alignment Guides Snapping Overlay */}
          {alignmentGuides && alignmentGuides.length > 0 && (
            <g className="pointer-events-none">
              {alignmentGuides.map((guide, idx) => (
                <line
                  key={`guide-${idx}`}
                  x1={guide.type === "vertical" ? guide.position : guide.start}
                  y1={guide.type === "vertical" ? guide.start : guide.position}
                  x2={guide.type === "vertical" ? guide.position : guide.end}
                  y2={guide.type === "vertical" ? guide.end : guide.position}
                  stroke="#ec4899"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              ))}
            </g>
          )}

          {/* Locked Elements Badges */}
          {elements.map((el) => {
            if (!el.isLocked) return null;
            return (
              <g
                key={`lock-badge-${el.id}`}
                transform={`translate(${el.x + Math.max(el.width - 22, 2)}, ${el.y + 4})`}
                className="pointer-events-none"
              >
                <rect width="18" height="18" rx="4" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
                <path
                  d="M6 7.5V6a3 3 0 0 1 6 0v1.5m-7 0h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"
                  fill="none"
                  stroke="#b45309"
                  strokeWidth="1.2"
                />
              </g>
            );
          })}

          {/* Marquee Selection Rectangle */}
          {selectionMarquee && (
            <rect
              x={selectionMarquee.minX}
              y={selectionMarquee.minY}
              width={selectionMarquee.width}
              height={selectionMarquee.height}
              fill="rgba(2, 132, 199, 0.08)"
              stroke="#0284c7"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          {/* Selection Box & Resize Handles */}
          {selectionBox && selectedIds.size > 0 && (
            <g className="pointer-events-auto">
              <rect
                x={selectionBox.minX - 4}
                y={selectionBox.minY - 4}
                width={selectionBox.width + 8}
                height={selectionBox.height + 8}
                fill="none"
                stroke={isAnyLocked ? "#d97706" : "#0284c7"}
                strokeWidth={1.5}
                strokeDasharray={isAnyLocked ? "3 3" : "4 4"}
              />

              {/* If locked, render lock badge on selection box instead of resize handles */}
              {isAnyLocked ? (
                <g
                  transform={`translate(${selectionBox.maxX - 14}, ${selectionBox.minY - 14})`}
                  className="pointer-events-none"
                >
                  <rect width="20" height="20" rx="5" fill="#fef3c7" stroke="#d97706" strokeWidth="1.2" />
                  <path
                    d="M7 8.5V7a3 3 0 0 1 6 0v1.5m-7 0h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"
                    fill="none"
                    stroke="#b45309"
                    strokeWidth="1.4"
                  />
                </g>
              ) : (
                resizeHandleList.map(({ handle, cx, cy, cursor }) => (
                  <g
                    key={handle}
                    data-handle={handle}
                    onPointerDown={handleResizeHandlePointerDown}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="cursor-pointer"
                  >
                    {/* Generous transparent hit area to guarantee easy clicking/dragging */}
                    <rect
                      x={cx - halfHit}
                      y={cy - halfHit}
                      width={hitSize}
                      height={hitSize}
                      fill="transparent"
                      style={{ cursor }}
                    />
                    {/* Visible crisp white handle with sky-blue border */}
                    <rect
                      x={cx - halfVis}
                      y={cy - halfVis}
                      width={visualSize}
                      height={visualSize}
                      rx={visualSize > 8 ? 2 : 1}
                      fill="#ffffff"
                      stroke="#0284c7"
                      strokeWidth={Math.max(1, 1.5 / viewport.zoom)}
                      style={{ cursor }}
                    />
                  </g>
                ))
              )}
            </g>
          )}
        </g>
      </svg>

      {/* HTML Interactive Elements Layer (Sticky Notes, Text Boxes, Images) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {elements.map((el) => {
          const isSelected = selectedIds.has(el.id);

          // STICKY NOTE
          if (el.type === "STICKY") {
            return (
              <div
                key={el.id}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  backgroundColor: el.fillColor,
                  borderColor: el.strokeColor,
                  color: el.textColor || "#78350f",
                  opacity: el.opacity,
                  zIndex: el.zIndex,
                }}
                className={`absolute p-3 rounded-2xl border shadow-md flex flex-col justify-between pointer-events-auto transition-shadow ${
                  isSelected ? "ring-2 ring-sky-500 shadow-lg" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement(el.id, e.shiftKey);
                }}
              >
                <textarea
                  value={el.text || ""}
                  onChange={(e) => onUpdateElement(el.id, { text: e.target.value })}
                  placeholder="Sticky note text..."
                  style={{ fontSize: el.fontSize || 16, textAlign: el.textAlign || "left" }}
                  className="w-full flex-1 bg-transparent resize-none border-none outline-none font-medium leading-snug p-0"
                />
                {el.authorName && (
                  <div className="pt-2 text-[10px] font-semibold opacity-60 flex items-center justify-between border-t border-black/5">
                    <span>{el.authorName}</span>
                    <span className="text-[9px]">Sticky</span>
                  </div>
                )}
              </div>
            );
          }

          // TEXT ELEMENT
          if (el.type === "TEXT") {
            return (
              <div
                key={el.id}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  minHeight: el.height,
                  fontSize: el.fontSize || 20,
                  color: el.textColor || "#0f172a",
                  textAlign: el.textAlign || "left",
                  opacity: el.opacity,
                  zIndex: el.zIndex,
                }}
                className={`absolute p-1 pointer-events-auto rounded-lg ${
                  isSelected ? "ring-1 ring-sky-400" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement(el.id, e.shiftKey);
                }}
              >
                <textarea
                  value={el.text || ""}
                  onChange={(e) => onUpdateElement(el.id, { text: e.target.value })}
                  placeholder="Text..."
                  rows={Math.max(1, (el.text || "").split("\n").length)}
                  className="w-full bg-transparent resize-none border-none outline-none font-medium leading-normal p-0 block"
                />
              </div>
            );
          }

          // IMAGE ELEMENT
          if (el.type === "IMAGE" && el.imageUrl) {
            return (
              <div
                key={el.id}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  opacity: el.opacity,
                  zIndex: el.zIndex,
                }}
                className={`absolute pointer-events-auto rounded-xl overflow-hidden border border-slate-200/80 shadow-md ${
                  isSelected ? "ring-2 ring-sky-500 shadow-lg" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement(el.id, e.shiftKey);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={el.imageUrl}
                  alt="Uploaded diagram"
                  className="w-full h-full object-contain pointer-events-none"
                />
              </div>
            );
          }

          return null;
        })}

        {/* Live Collaborator Cursors & Presence */}
        {collaborators.map((c) => {
          if (!c.cursor) return null;
          return (
            <div
              key={c.clientId}
              style={{
                left: c.cursor.x,
                top: c.cursor.y,
                pointerEvents: "none",
                zIndex: 9999,
              }}
              className="absolute transition-transform duration-75 ease-out select-none pointer-events-none"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="-translate-x-1 -translate-y-1 drop-shadow-md"
              >
                <path
                  d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"
                  fill={c.color || "#0284c7"}
                />
              </svg>
              <div
                style={{ backgroundColor: c.color || "#0284c7" }}
                className="ml-3.5 -mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white whitespace-nowrap shadow-md flex items-center gap-1"
              >
                <span>{c.userName}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

