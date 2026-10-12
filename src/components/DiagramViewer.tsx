import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Layers, Eye, Link2, X } from 'lucide-react';
import type { DiagramExtractionResult, ConnectionTrace } from '../types/index.js';

interface DiagramViewerProps {
  imageBase64: string;
  imageMimeType: string;
  extraction: DiagramExtractionResult;
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string | null) => void;
  activeTrace?: ConnectionTrace | null;
  onClearTrace?: () => void;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({
  imageBase64,
  imageMimeType,
  extraction,
  selectedComponentId,
  onSelectComponent,
  activeTrace,
  onClearTrace,
}) => {
  const [scale, setScale] = useState(1);
  const [showOverlays, setShowOverlays] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(1);

  const imgSrc = `data:${imageMimeType};base64,${imageBase64}`;

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Viewer Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          <h3 className="text-xs font-semibold text-white">Intended Architecture Diagram</h3>
          <span className="text-[11px] text-slate-400">
            ({extraction.components.length} components)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={`text-[11px] px-2.5 py-1 rounded border transition-colors flex items-center gap-1 cursor-pointer ${
              showOverlays
                ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-300'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title="Toggle component overlay bounding boxes"
          >
            <Eye className="h-3 w-3" />
            <span>Overlays</span>
          </button>

          <div className="h-3.5 w-px bg-slate-800"></div>

          <button
            onClick={zoomOut}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-400 w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset Zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Feature One: Active Connection Trace Callout */}
      {activeTrace && (
        <div className="border-b border-indigo-900/60 bg-indigo-950/40 px-4 py-2.5 text-xs text-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <Link2 className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
            <div className="truncate">
              <span className="font-semibold text-white">Tracing Connection: </span>
              <span className="font-mono text-amber-300">
                {activeTrace.expectedConnection}
              </span>
            </div>
          </div>
          {onClearTrace && (
            <button
              onClick={onClearTrace}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Clear Highlight"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Image & Overlays Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4 min-h-[360px]"
      >
        <div
          className="relative transition-transform duration-100 ease-out inline-block max-w-full"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
          <img
            src={imgSrc}
            alt="Architecture Diagram"
            className="max-h-[480px] w-auto object-contain rounded shadow-lg border border-slate-800"
          />

          {/* Interactive Bounding Box Overlays */}
          {showOverlays &&
            extraction.components.map((comp) => {
              if (!comp.bounds) return null;
              const isSelected = selectedComponentId === comp.id;

              const isTraceFrom =
                activeTrace?.fromComponentName?.toLowerCase() === comp.name.toLowerCase() ||
                activeTrace?.fromComponentId === comp.id;
              const isTraceTo =
                activeTrace?.toComponentName?.toLowerCase() === comp.name.toLowerCase() ||
                activeTrace?.toComponentId === comp.id;
              const isInTrace = isTraceFrom || isTraceTo;

              return (
                <div
                  key={comp.id}
                  onClick={() => onSelectComponent(isSelected ? null : comp.id)}
                  style={{
                    left: `${comp.bounds.x}%`,
                    top: `${comp.bounds.y}%`,
                    width: `${comp.bounds.width}%`,
                    height: `${comp.bounds.height}%`,
                  }}
                  className={`absolute border rounded cursor-pointer transition-all ${
                    isInTrace
                      ? 'border-amber-400 bg-amber-500/25 ring-2 ring-amber-400/80 z-30 shadow-lg'
                      : isSelected
                      ? 'border-indigo-400 bg-indigo-500/30 ring-2 ring-indigo-400/50 z-20'
                      : 'border-indigo-500/40 bg-indigo-500/10 hover:border-indigo-400 hover:bg-indigo-500/20 z-10'
                  }`}
                  title={`${comp.name} (${comp.type})`}
                >
                  <span
                    className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-mono shadow ${
                      isInTrace
                        ? 'bg-amber-950 border border-amber-400 text-amber-200 font-bold'
                        : 'bg-slate-950/90 border border-indigo-500/40 text-indigo-300'
                    }`}
                  >
                    {comp.name}
                    {isInTrace && (isTraceFrom ? ' (Source)' : ' (Target)')}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Component quick selectors */}
      <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-2 flex items-center gap-3 text-xs overflow-x-auto text-slate-400">
        <span className="text-[11px] font-medium text-slate-400 shrink-0">
          Components:
        </span>
        <div className="flex items-center gap-1.5">
          {extraction.components.map((comp) => (
            <button
              key={comp.id}
              onClick={() =>
                onSelectComponent(selectedComponentId === comp.id ? null : comp.id)
              }
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors shrink-0 cursor-pointer ${
                selectedComponentId === comp.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              {comp.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
