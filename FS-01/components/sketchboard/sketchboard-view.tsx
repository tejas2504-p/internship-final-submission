"use client";

import React, { useState, useCallback } from "react";
import { useSketchboard } from "@/lib/sketchboard/use-sketchboard";
import { SketchboardHeader } from "./sketchboard-header";
import { SketchboardToolbar } from "./sketchboard-toolbar";
import { SketchboardPropertiesPanel } from "./sketchboard-properties-panel";
import { SketchboardCanvas } from "./sketchboard-canvas";
import { SketchboardZoomControls } from "./sketchboard-zoom-controls";
import { SketchboardEmptyState } from "./sketchboard-empty-state";
import { SketchboardExportModal } from "./sketchboard-export-modal";
import { SketchboardKeyboardDialog } from "./sketchboard-keyboard-dialog";
import { SketchElement, PersistedSketchboardData } from "@/types/sketchboard";

interface SketchboardViewProps {
  workspace: {
    id: string;
    name: string;
    ownerId?: string;
    currentUserRole?: string;
    canEdit?: boolean;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  initialSketchboard?: PersistedSketchboardData;
}

export function SketchboardView({
  workspace,
  user,
  initialSketchboard,
}: SketchboardViewProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  const {
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
    collabStatus,
    collaborators,
    strokeColor,
    fillColor,
    strokeWidth,
    strokeStyle,
    opacity,
    fontSize,
    textAlign,
    textColor,
    currentDrawingElement,
    selectionMarquee,
    alignmentGuides,
    isPanning,
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
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    startResize,
  } = useSketchboard({
    workspaceId: workspace.id,
    boardId: initialSketchboard?.id || undefined,
    initialName: `${workspace.name} Whiteboard`,
    authorName: user.name || "Tejas",
    initialSketchboard,
    canEdit: workspace.canEdit ?? true,
  });

  // Selected elements array
  const selectedElements = elements.filter((el) => selectedIds.has(el.id));

  // Image upload handler
  const handleImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          const img = new Image();
          img.onload = () => {
            const maxDim = 400;
            let w = img.naturalWidth || 300;
            let h = img.naturalHeight || 200;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            insertImage(result, w, h);
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    },
    [insertImage]
  );

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
      e.target.value = "";
    }
  };

  // Drag and drop onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverCanvas(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverCanvas(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverCanvas(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageFile(file);
    }
  };

  const handleAddStarterElements = (starters: SketchElement[]) => {
    starters.forEach((el) => {
      elements.push(el);
    });
    // Trigger update
    updateSelectedProperties({});
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-screen h-screen overflow-hidden bg-white select-none flex flex-col"
    >
      {/* Top Header */}
      <SketchboardHeader
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        boardId={initialSketchboard?.id || undefined}
        boardName={boardName}
        onUpdateBoardName={setBoardName}
        saveStatus={saveStatus}
        collabStatus={collabStatus}
        collaborators={collaborators}
        canEdit={canEdit}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        gridMode={gridMode}
        onToggleGridMode={setGridMode}
        canvasBg={canvasBg}
        onChangeCanvasBg={setCanvasBg}
        onFitToScreen={() => fitToScreen(window.innerWidth, window.innerHeight)}
        onResetZoom={resetZoom}
        onOpenExportModal={() => setIsExportOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsOpen(true)}
        authorName={user.name}
      />

      {/* Left Drawing Toolbar */}
      <SketchboardToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onImageUpload={handleImageInputChange}
      />

      {/* Contextual Properties Panel (shows when items selected or tool is active) */}
      <SketchboardPropertiesPanel
        selectedElements={selectedElements}
        strokeColor={strokeColor}
        fillColor={fillColor}
        strokeWidth={strokeWidth}
        strokeStyle={strokeStyle}
        opacity={opacity}
        fontSize={fontSize}
        textAlign={textAlign}
        textColor={textColor}
        onUpdateProperties={updateSelectedProperties}
        onDuplicate={duplicate}
        onDelete={deleteSelected}
        onToggleLock={toggleLockSelected}
        onGroup={groupSelected}
        onUngroup={ungroupSelected}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onBringForward={bringForward}
        onSendBackward={sendBackward}
        onAlign={align}
        onDistribute={distribute}
      />

      {/* Infinite Canvas */}
      <SketchboardCanvas
        elements={elements}
        selectedIds={selectedIds}
        viewport={viewport}
        gridMode={gridMode}
        canvasBg={canvasBg}
        currentDrawingElement={currentDrawingElement}
        selectionMarquee={selectionMarquee}
        alignmentGuides={alignmentGuides}
        isPanning={isPanning}
        canEdit={canEdit}
        collaborators={collaborators}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onStartResize={startResize}
        onUpdateElement={updateElement}
        onSelectElement={selectElement}
      />

      {/* Empty State Overlay */}
      {elements.length === 0 && (
        <SketchboardEmptyState
          onAddStarterElements={handleAddStarterElements}
          authorName={user.name}
        />
      )}

      {/* Zoom Controls */}
      <SketchboardZoomControls
        zoom={viewport.zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onSetZoom={setZoom}
        onFitToContent={() => fitToScreen(window.innerWidth, window.innerHeight)}
      />

      {/* Drag overlay indicator */}
      {isDragOverCanvas && (
        <div className="absolute inset-0 z-50 bg-sky-500/10 border-4 border-dashed border-sky-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl text-sky-600 font-bold text-sm">
            Drop image here to add to Sketchboard
          </div>
        </div>
      )}

      {/* Export Modal */}
      <SketchboardExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        elements={elements}
        boardName={boardName}
        canvasBg={canvasBg}
        onImportJson={importFromJson}
      />

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      <SketchboardKeyboardDialog
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}

