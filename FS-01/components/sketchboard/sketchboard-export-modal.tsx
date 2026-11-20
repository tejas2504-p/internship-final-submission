"use client";

import React, { useState, useRef } from "react";
import { X, FileImage, Code2, FileJson, Check, Copy, Upload } from "lucide-react";
import { SketchElement, CanvasBgTheme } from "@/types/sketchboard";
import {
  exportToJson,
  downloadFile,
  getElementsBoundingBox,
  pointsToSvgPath,
} from "@/lib/sketchboard/utils";

interface SketchboardExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: SketchElement[];
  boardName: string;
  canvasBg?: CanvasBgTheme;
  onImportJson?: (jsonString: string) => void;
}

export function SketchboardExportModal({
  isOpen,
  onClose,
  elements,
  boardName,
  canvasBg = "white",
  onImportJson,
}: SketchboardExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const getBgColor = () => {
    switch (canvasBg) {
      case "cream":
        return "#fffbeb";
      case "slate":
        return "#f8fafc";
      case "dark":
        return "#0f172a";
      case "white":
      default:
        return "#ffffff";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (text && onImportJson) {
          onImportJson(text);
          onClose();
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Failed to parse JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const sanitizedName = boardName.toLowerCase().replace(/[^a-z0-9]/g, "-") || "sketchboard";

  // 1. Export JSON
  const handleExportJson = () => {
    const jsonStr = exportToJson(elements, boardName);
    downloadFile(jsonStr, `${sanitizedName}.json`, "application/json");
    onClose();
  };

  // 2. Export SVG
  const handleExportSvg = () => {
    const box = getElementsBoundingBox(elements) || {
      minX: 0,
      minY: 0,
      maxX: 800,
      maxY: 600,
      width: 800,
      height: 600,
    };
    const pad = 40;
    const viewBox = `${box.minX - pad} ${box.minY - pad} ${box.width + pad * 2} ${box.height + pad * 2}`;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${box.width + pad * 2}" height="${box.height + pad * 2}" style="background-color: ${getBgColor()};">\n`;
    svgContent += `  <defs>\n`;
    svgContent += `    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
    svgContent += `      <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284c7" />\n`;
    svgContent += `    </marker>\n`;
    svgContent += `  </defs>\n`;

    elements.forEach((el) => {
      if (el.type === "PEN" || el.type === "HIGHLIGHTER") {
        const d = pointsToSvgPath(el.points || []);
        svgContent += `  <path d="${d}" fill="none" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${el.opacity}" />\n`;
      } else if (el.type === "RECTANGLE") {
        svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="8" fill="${el.fillColor}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${el.opacity}" />\n`;
      } else if (el.type === "CIRCLE" || el.type === "ELLIPSE") {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        svgContent += `  <ellipse cx="${cx}" cy="${cy}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${el.fillColor}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${el.opacity}" />\n`;
      } else if (el.type === "DIAMOND") {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        svgContent += `  <polygon points="${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}" fill="${el.fillColor}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${el.opacity}" />\n`;
      } else if (el.type === "LINE") {
        svgContent += `  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" opacity="${el.opacity}" />\n`;
      } else if (el.type === "ARROW") {
        svgContent += `  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" marker-end="url(#arrow)" opacity="${el.opacity}" />\n`;
      } else if (el.type === "STICKY") {
        svgContent += `  <g>\n`;
        svgContent += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="12" fill="${el.fillColor}" stroke="${el.strokeColor}" stroke-width="2" />\n`;
        svgContent += `    <text x="${el.x + 14}" y="${el.y + 28}" font-family="sans-serif" font-size="${el.fontSize || 16}" fill="${el.textColor || "#78350f"}">${(el.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>\n`;
        svgContent += `  </g>\n`;
      } else if (el.type === "TEXT") {
        svgContent += `  <text x="${el.x}" y="${el.y + (el.fontSize || 20)}" font-family="sans-serif" font-size="${el.fontSize || 20}" fill="${el.textColor || "#0f172a"}">${(el.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>\n`;
      }
    });

    svgContent += `</svg>`;
    downloadFile(svgContent, `${sanitizedName}.svg`, "image/svg+xml");
    onClose();
  };

  // 3. Export PNG
  const handleExportPng = () => {
    const box = getElementsBoundingBox(elements) || {
      minX: 0,
      minY: 0,
      maxX: 800,
      maxY: 600,
      width: 800,
      height: 600,
    };
    const pad = 40;
    const width = Math.max(400, box.width + pad * 2);
    const height = Math.max(300, box.height + pad * 2);

    const canvas = document.createElement("canvas");
    canvas.width = width * 2; // 2x Retina
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.fillStyle = getBgColor();
    ctx.fillRect(0, 0, width, height);

    // Draw elements translated
    ctx.save();
    ctx.translate(-box.minX + pad, -box.minY + pad);

    elements.forEach((el) => {
      ctx.globalAlpha = el.opacity;

      if (el.type === "RECTANGLE") {
        if (el.fillColor && el.fillColor !== "transparent") {
          ctx.fillStyle = el.fillColor;
          ctx.fillRect(el.x, el.y, el.width, el.height);
        }
        ctx.strokeStyle = el.strokeColor;
        ctx.lineWidth = el.strokeWidth;
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === "CIRCLE" || el.type === "ELLIPSE") {
        ctx.beginPath();
        ctx.ellipse(
          el.x + el.width / 2,
          el.y + el.height / 2,
          el.width / 2,
          el.height / 2,
          0,
          0,
          2 * Math.PI
        );
        if (el.fillColor && el.fillColor !== "transparent") {
          ctx.fillStyle = el.fillColor;
          ctx.fill();
        }
        ctx.strokeStyle = el.strokeColor;
        ctx.lineWidth = el.strokeWidth;
        ctx.stroke();
      } else if (el.type === "PEN" || el.type === "HIGHLIGHTER") {
        if (el.points && el.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.strokeStyle = el.strokeColor;
          ctx.lineWidth = el.strokeWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke();
        }
      } else if (el.type === "STICKY") {
        ctx.fillStyle = el.fillColor;
        ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.strokeStyle = el.strokeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(el.x, el.y, el.width, el.height);

        ctx.fillStyle = el.textColor || "#78350f";
        ctx.font = `${el.fontSize || 16}px sans-serif`;
        ctx.fillText(el.text || "", el.x + 12, el.y + 28);
      } else if (el.type === "TEXT") {
        ctx.fillStyle = el.textColor || "#0f172a";
        ctx.font = `${el.fontSize || 20}px sans-serif`;
        ctx.fillText(el.text || "", el.x, el.y + (el.fontSize || 20));
      }
    });

    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sanitizedName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
      }
    });
  };

  const handleCopyJson = () => {
    const jsonStr = exportToJson(elements, boardName);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-6 space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Export Sketchboard</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Download your board or backup data locally
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={handleExportPng}
            className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 text-slate-800 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileImage className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Export as PNG Image</div>
                <div className="text-[11px] text-slate-500">
                  Crisp high-resolution 2x retina raster image
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">
              .PNG
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportSvg}
            className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-800 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Export as Vector SVG</div>
                <div className="text-[11px] text-slate-500">
                  Lossless scalable vector graphic format
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
              .SVG
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-800 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Export as JSON Backup</div>
                <div className="text-[11px] text-slate-500">
                  Full editable raw data structure
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              .JSON
            </span>
          </button>

          {/* Import JSON */}
          {onImportJson && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-slate-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Import JSON Backup</div>
                    <div className="text-[11px] text-slate-500">
                      Load and merge elements from a saved backup file
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  IMPORT
                </span>
              </button>
            </>
          )}
        </div>

        {importError && (
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
            {importError}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopyJson}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-sky-600 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied to clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Raw JSON</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

