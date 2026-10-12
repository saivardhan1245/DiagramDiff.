import React from 'react';
import {
  ArrowRight,
  Link2,
  FileCode2,
  GitCompare,
  UploadCloud,
  FileArchive,
  Layers,
} from 'lucide-react';

interface LandingViewProps {
  onStartAnalysis: () => void;
  onOpenTimeline?: () => void;
  hasSnapshots?: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onStartAnalysis,
  onOpenTimeline,
  hasSnapshots,
}) => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-center">
      {/* Title & Subtitle */}
      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl font-sans">
        DiagramDiff
      </h1>

      <p className="mt-3 text-xl font-medium text-indigo-400 italic">
        Does your code match your design?
      </p>

      {/* Main explanation */}
      <p className="mt-5 text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
        Upload your architecture diagram and project code. DiagramDiff compares them
        and finds possible mismatches using Gemma 4 and code analysis.
      </p>

      {/* Action CTA */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={onStartAnalysis}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/60 hover:bg-indigo-500 transition-all cursor-pointer"
        >
          <span>Check My Architecture</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {hasSnapshots && onOpenTimeline && (
          <button
            onClick={onOpenTimeline}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <GitCompare className="h-4 w-4 text-indigo-400" />
            <span>View Architecture Timeline</span>
          </button>
        )}
      </div>

      {/* Three benefits */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400 mb-3">
            <Link2 className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Find missing connections</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Detect endpoints, services, or databases shown in the diagram but omitted from code.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mb-3">
            <FileCode2 className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">See issues in code</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Jump directly to exact source files, routes, and line numbers supporting every finding.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-950/80 border border-sky-800/60 text-sky-400 mb-3">
            <GitCompare className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Track what changed</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Compare version snapshots to see new, fixed, and unchanged architectural differences.
          </p>
        </div>
      </div>

      {/* Analysis workflow */}
      <div className="mt-14 rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-left max-w-3xl mx-auto">
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-4 text-center">
          Analysis Workflow
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/60">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold shrink-0">
              1
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Upload Architecture Diagram</p>
              <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPEG, or WebP image</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/60">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold shrink-0">
              2
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Upload Project ZIP</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Or select source files</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/60">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold shrink-0">
              3
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Review Differences</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Evidence-backed findings</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
