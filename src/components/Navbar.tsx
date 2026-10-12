import React from 'react';
import { Layers, Plus, GitCompare } from 'lucide-react';

interface NavbarProps {
  onNewAnalysis: () => void;
  hasActiveSession: boolean;
  onViewResults?: () => void;
  onOpenTimeline?: () => void;
  onResetToHome: () => void;
  modelName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNewAnalysis,
  hasActiveSession,
  onViewResults,
  onOpenTimeline,
  onResetToHome,
  modelName,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <button
            onClick={onResetToHome}
            className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 group-hover:border-indigo-500/60 transition-colors">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                DiagramDiff
              </span>
              <p className="text-[11px] text-slate-400">Architecture Consistency Checker</p>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 border-l border-slate-800 pl-6">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              {modelName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenTimeline && (
            <button
              onClick={onOpenTimeline}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
            >
              <GitCompare className="h-3.5 w-3.5 text-sky-400" />
              <span>Drift Timeline</span>
            </button>
          )}

          {hasActiveSession && onViewResults && (
            <button
              onClick={onViewResults}
              className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
            >
              Current Results
            </button>
          )}

          <button
            onClick={onNewAnalysis}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-all shadow-sm shadow-indigo-950/50 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Analysis</span>
          </button>
        </div>
      </div>
    </header>
  );
};
