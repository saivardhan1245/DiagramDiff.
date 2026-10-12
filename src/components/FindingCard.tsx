import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Info,
  FileCode,
  Layers,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
} from 'lucide-react';
import type { Finding, CodeReference, UserFindingStatus } from '../types/index.js';

interface FindingCardProps {
  finding: Finding;
  onInspectCode: (ref: CodeReference) => void;
  onStatusChange?: (status: UserFindingStatus) => void;
  onFocusDiagramConnection?: () => void;
  isHighlighted?: boolean;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  onInspectCode,
  onStatusChange,
  onFocusDiagramConnection,
  isHighlighted,
}) => {
  const currentStatus = finding.userStatus || 'unresolved';

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
            <AlertCircle className="h-3 w-3" />
            <span>Critical Issue</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span>Possible Mismatch</span>
          </span>
        );
      case 'inconclusive':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400">
            <HelpCircle className="h-3 w-3" />
            <span>Inconclusive</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <Info className="h-3 w-3" />
            <span>Notice</span>
          </span>
        );
    }
  };

  const primaryRef = finding.implementationEvidence.references[0];

  return (
    <div
      className={`rounded-xl border bg-slate-900/90 p-5 transition-all text-left ${
        isHighlighted
          ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-950/40 bg-slate-900'
          : currentStatus === 'real_issue'
          ? 'border-rose-900/60 bg-rose-950/10'
          : currentStatus === 'intentional'
          ? 'border-emerald-900/60 bg-emerald-950/10'
          : 'border-slate-800 hover:border-slate-700/80'
      }`}
    >
      {/* Top row: Title and Severity Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <h4 className="text-sm font-semibold text-white leading-snug">
          {finding.title}
        </h4>
        <div className="flex items-center gap-2 shrink-0">
          {getSeverityBadge(finding.severity)}
        </div>
      </div>

      {/* Explanation in 1-2 simple sentences */}
      <p className="mt-3 text-xs text-slate-200 leading-relaxed font-normal">
        {finding.explanation}
      </p>

      {/* Feature One: Broken Connection Trace Box */}
      {finding.connectionTrace && (
        <div className="mt-3.5 rounded-lg border border-indigo-900/40 bg-indigo-950/20 p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span>Trace the Connection</span>
            </span>
            {onFocusDiagramConnection && (
              <button
                type="button"
                onClick={onFocusDiagramConnection}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-200 cursor-pointer"
              >
                <Eye className="h-3 w-3" />
                <span>Show on Diagram</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            <div className="rounded bg-slate-950/70 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">
                Expected in Design:
              </span>
              <p className="text-xs font-mono text-slate-200 break-all">
                {finding.connectionTrace.expectedConnection}
              </p>
            </div>

            <div className="rounded bg-slate-950/70 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">
                Found in Code:
              </span>
              <p className="text-xs font-mono text-indigo-300 break-all">
                {finding.connectionTrace.foundEvidence}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Code reference location badge */}
      {primaryRef && (
        <div className="mt-3 flex items-center justify-between text-xs p-2 rounded bg-slate-950/70 border border-slate-800/80">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px] text-slate-300 truncate">
              {primaryRef.filePath}
              {primaryRef.lineNumber ? ` : Line ${primaryRef.lineNumber}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onInspectCode(primaryRef)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <span>View Code</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </button>
        </div>
      )}

      {/* User Decision Bar: Real Issue, Intentional Difference, Unresolved */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <span>Review Status:</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onStatusChange?.('unresolved')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors flex items-center gap-1 cursor-pointer ${
              currentStatus === 'unresolved'
                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Clock className="h-3 w-3" />
            <span>Unresolved</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusChange?.('real_issue')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors flex items-center gap-1 cursor-pointer ${
              currentStatus === 'real_issue'
                ? 'bg-rose-950 text-rose-300 border border-rose-800 font-semibold'
                : 'text-slate-400 hover:text-rose-300 hover:bg-slate-900'
            }`}
          >
            <XCircle className="h-3 w-3 text-rose-400" />
            <span>Real Issue</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusChange?.('intentional')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors flex items-center gap-1 cursor-pointer ${
              currentStatus === 'intentional'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-900'
            }`}
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span>Intentional</span>
          </button>
        </div>
      </div>
    </div>
  );
};
