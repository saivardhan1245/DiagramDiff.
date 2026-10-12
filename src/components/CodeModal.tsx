import React from 'react';
import { X, FileCode, Copy, Check } from 'lucide-react';
import type { CodeReference } from '../types/index.js';

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reference: CodeReference | null;
  fullFileContent?: string;
}

export const CodeModal: React.FC<CodeModalProps> = ({
  isOpen,
  onClose,
  reference,
  fullFileContent,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !reference) return null;

  const handleCopy = () => {
    const text = reference.snippet || fullFileContent || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Prepare line numbers and snippet
  const lines = fullFileContent ? fullFileContent.split('\n') : [];
  const targetLine = reference.lineNumber || 1;

  // Window of lines around target line
  const startLine = Math.max(0, targetLine - 8);
  const endLine = Math.min(lines.length, targetLine + 8);
  const windowLines = lines.slice(startLine, endLine);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileCode className="h-4 w-4 text-indigo-400 shrink-0" />
            <h3 className="text-xs font-mono font-medium text-white truncate">
              {reference.filePath}
              {reference.lineNumber ? ` : Line ${reference.lineNumber}` : ''}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs">
          {lines.length > 0 ? (
            <div className="space-y-0.5">
              {windowLines.map((line, idx) => {
                const currentLineNumber = startLine + idx + 1;
                const isTarget = currentLineNumber === reference.lineNumber;

                return (
                  <div
                    key={idx}
                    className={`flex items-start rounded px-2 py-0.5 ${
                      isTarget
                        ? 'bg-indigo-950/80 border-l-2 border-indigo-400 text-indigo-200'
                        : 'text-slate-300 hover:bg-slate-900/50'
                    }`}
                  >
                    <span className="w-10 select-none text-[10px] text-slate-500 text-right pr-4 shrink-0">
                      {currentLineNumber}
                    </span>
                    <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed">
                      {line || ' '}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-slate-400 text-xs">
              <p className="font-semibold text-slate-300 mb-2">Evidence snippet:</p>
              <pre className="p-3 rounded bg-slate-900 border border-slate-800 text-indigo-300 whitespace-pre-wrap">
                {reference.snippet || 'No raw snippet captured.'}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-6 py-2.5 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Verifiable implementation provenance from uploaded files</span>
          <button
            onClick={onClose}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
