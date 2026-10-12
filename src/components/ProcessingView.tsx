import React from 'react';
import { Loader2, AlertCircle, RefreshCw, Layers } from 'lucide-react';

interface ProcessingViewProps {
  currentStage: string;
  error: string | null;
  errorDetails?: string | null;
  onRetry: () => void;
  onCancel: () => void;
  modelName: string;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({
  currentStage,
  error,
  errorDetails,
  onRetry,
  onCancel,
  modelName,
}) => {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      {error ? (
        <div className="rounded-xl border border-rose-850 bg-rose-950/40 p-6 text-left shadow-2xl backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-rose-400 mb-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <h2 className="text-sm font-semibold text-white">Analysis Failed</h2>
          </div>

          <p className="text-xs text-rose-200 leading-relaxed">{error}</p>

          {errorDetails && (
            <div className="mt-3 rounded bg-rose-950/80 p-2.5 font-mono text-[11px] text-rose-300 border border-rose-900 overflow-x-auto">
              {errorDetails}
            </div>
          )}

          <div className="mt-5 pt-3 border-t border-rose-900/60 flex items-center gap-2.5">
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
            <button
              onClick={onCancel}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-400 mb-4">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>

          <h2 className="text-base font-semibold text-white">Checking Your Architecture</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Comparing design diagram with implementation code
          </p>

          <div className="mt-6 rounded-lg bg-slate-950 p-3.5 border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <span>{currentStage}</span>
          </div>

          <p className="mt-4 text-[11px] text-slate-500 font-mono">
            Model: {modelName}
          </p>
        </div>
      )}
    </div>
  );
};
