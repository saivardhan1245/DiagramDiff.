import React, { useState } from 'react';
import { X, Download, Copy, Check, FileJson, FileText } from 'lucide-react';
import type { AnalysisSession } from '../types/index.js';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AnalysisSession;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  session,
}) => {
  const [copiedFormat, setCopiedFormat] = useState<'md' | 'json' | null>(null);

  if (!isOpen) return null;

  const handleDownload = (format: 'markdown' | 'json') => {
    window.location.href = `/api/export/${session.id}/${format}`;
  };

  const handleCopy = async (format: 'md' | 'json') => {
    try {
      const res = await fetch(`/api/export/${session.id}/${format}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2500);
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-6 text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Export Architecture Report</h2>
            <p className="text-xs text-slate-400">
              Download or copy evidence-backed findings for {session.projectName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Overview Stats */}
        <div className="mt-4 rounded-lg bg-slate-950 p-3.5 border border-slate-800 text-xs text-slate-300 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Project:</span>
            <span className="font-medium text-white">{session.projectName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Multimodal Engine:</span>
            <span className="font-mono text-indigo-400 text-[11px]">{session.modelUsed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Files Analyzed:</span>
            <span>{session.summary.analyzedFilesCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Findings:</span>
            <span className="font-medium text-white">{session.summary.totalFindings}</span>
          </div>
        </div>

        {/* Export Options */}
        <div className="mt-6 space-y-4">
          {/* Markdown Option */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Markdown Report (.md)</h4>
                <p className="text-[11px] text-slate-400">
                  Formatted for GitHub pull requests and architecture documentation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy('md')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded border border-slate-800 transition-colors"
                title="Copy Markdown"
              >
                {copiedFormat === 'md' ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => handleDownload('markdown')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* JSON Option */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                <FileJson className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Machine-Readable JSON (.json)</h4>
                <p className="text-[11px] text-slate-400">
                  Full structured AST evidence, coordinates, and finding objects
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy('json')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded border border-slate-800 transition-colors"
                title="Copy JSON"
              >
                {copiedFormat === 'json' ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => handleDownload('json')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-slate-800 pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
