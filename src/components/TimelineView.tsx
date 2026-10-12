import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  FileCode,
  Layers,
  Calendar,
  Trash2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { Snapshot, DriftComparisonResult, Finding, CodeReference } from '../types/index.js';
import { CodeModal } from './CodeModal.js';

interface TimelineViewProps {
  currentSessionId?: string;
  currentProjectName?: string;
  onInspectCode: (ref: CodeReference) => void;
  onBackToResults?: () => void;
  onNewAnalysis: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  currentSessionId,
  currentProjectName,
  onInspectCode,
  onBackToResults,
  onNewAnalysis,
}) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [baseId, setBaseId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [comparison, setComparison] = useState<DriftComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'new' | 'fixed' | 'unchanged'>('new');
  const [viewDiagrams, setViewDiagrams] = useState<'base' | 'target' | 'none'>('none');
  const [saveLabel, setSaveLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load snapshots from backend
  const fetchSnapshots = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/snapshots');
      const data = await res.json();
      if (data.success && Array.isArray(data.snapshots)) {
        setSnapshots(data.snapshots);
        // Default select latest two if available
        if (data.snapshots.length >= 2) {
          setBaseId(data.snapshots[0].id);
          setTargetId(data.snapshots[1].id);
        } else if (data.snapshots.length === 1) {
          setBaseId(data.snapshots[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load snapshots:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  // Save current session as a snapshot
  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSessionId || !saveLabel.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          versionLabel: saveLabel.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save snapshot');

      setSaveSuccess(true);
      setSaveLabel('');
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchSnapshots();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving snapshot');
    } finally {
      setIsSaving(false);
    }
  };

  // Run drift comparison
  const handleCompare = async () => {
    if (!baseId || !targetId || baseId === targetId) {
      setErrorMsg('Please choose two different versions to compare.');
      return;
    }

    setIsComparing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/snapshots/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseSnapshotId: baseId,
          targetSnapshotId: targetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Comparison failed');

      setComparison(data.comparison);
      // set default active category with items
      if (data.comparison.stats.newCount > 0) setActiveCategory('new');
      else if (data.comparison.stats.fixedCount > 0) setActiveCategory('fixed');
      else setActiveCategory('unchanged');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error comparing snapshots');
    } finally {
      setIsComparing(false);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    try {
      await fetch(`/api/snapshots/${id}`, { method: 'DELETE' });
      if (baseId === id) setBaseId('');
      if (targetId === id) setTargetId('');
      setComparison(null);
      await fetchSnapshots();
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Active findings for current category
  const activeFindings = comparison
    ? activeCategory === 'new'
      ? comparison.newFindings
      : activeCategory === 'fixed'
      ? comparison.fixedFindings
      : comparison.unchangedFindings
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                Architecture Drift Timeline
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Track what changed between versions: detect newly introduced issues and verify fixes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onBackToResults && (
              <button
                onClick={onBackToResults}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Back to Analysis Results
              </button>
            )}
            <button
              onClick={onNewAnalysis}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Analyze New Version
            </button>
          </div>
        </div>

        {/* Save Current Session Bar */}
        {currentSessionId && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-lg">
            <span className="text-xs text-slate-300">
              Save current analysis (<strong>{currentProjectName || 'Active'}</strong>) as a snapshot:
            </span>
            <form onSubmit={handleSaveSnapshot} className="flex items-center gap-2">
              <input
                type="text"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="e.g. v1.0 or Sprint-4"
                className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none w-36"
                required
              />
              <button
                type="submit"
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Snapshot'}
              </button>
              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-medium">Saved!</span>
              )}
            </form>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-rose-950/50 border border-rose-800 p-3 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Snapshot Comparison Selector */}
      {snapshots.length >= 2 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider text-slate-400">
            Compare Two Saved Snapshots
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Base Snapshot Dropdown */}
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Base Version (Previous):
              </label>
              <select
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">Select Base Snapshot</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.versionLabel} - {s.projectName} ({new Date(s.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 text-center text-slate-500">
              <ArrowRight className="h-5 w-5 mx-auto hidden sm:block" />
              <span className="sm:hidden text-xs text-slate-400">compare with</span>
            </div>

            {/* Target Snapshot Dropdown */}
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Target Version (Newer):
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">Select Target Snapshot</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.versionLabel} - {s.projectName} ({new Date(s.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleCompare}
              disabled={isComparing || !baseId || !targetId || baseId === targetId}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-40"
            >
              {isComparing ? 'Comparing...' : 'Compare Architecture Drift'}
            </button>
          </div>
        </div>
      ) : (
        /* Honest empty state when < 2 snapshots */
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center max-w-2xl mx-auto">
          <GitCompare className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white">Need At Least 2 Snapshots to Compare</h2>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed max-w-lg mx-auto">
            Architecture Drift compares two real versions of your project. Currently, you have{' '}
            <strong>{snapshots.length} saved snapshot</strong>.
            Save your current analysis as a snapshot above, then upload an updated diagram or code version to compare them.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={onNewAnalysis}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer"
            >
              Upload & Analyze Version
            </button>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Drift Stats Header */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Comparing {comparison.baseSnapshot.versionLabel} ➔ {comparison.targetSnapshot.versionLabel}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real drift calculation based on verifiable evidence from both snapshots
                </p>
              </div>

              {/* Three Category Selector Tabs */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveCategory('new')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'new'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                  <span>New Issues ({comparison.stats.newCount})</span>
                </button>

                <button
                  onClick={() => setActiveCategory('fixed')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'fixed'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Fixed Issues ({comparison.stats.fixedCount})</span>
                </button>

                <button
                  onClick={() => setActiveCategory('unchanged')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'unchanged'
                      ? 'bg-slate-800 text-slate-200 border border-slate-700'
                      : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                  }`}
                >
                  <MinusCircle className="h-3.5 w-3.5 text-slate-400" />
                  <span>Unchanged ({comparison.stats.unchangedCount})</span>
                </button>
              </div>
            </div>

            {/* Findings List for Active Category */}
            <div className="mt-5 space-y-4">
              {activeFindings.length > 0 ? (
                activeFindings.map((f, idx) => (
                  <div
                    key={f.id || idx}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2 mb-2">
                      <h4 className="text-xs font-semibold text-white">{f.title}</h4>
                      <span className="text-[11px] font-mono text-slate-400 uppercase">
                        {activeCategory}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{f.explanation}</p>

                    {/* Traceable Evidence */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 font-semibold block mb-0.5">
                          Diagram Evidence:
                        </span>
                        <span className="text-slate-300">
                          {f.diagramEvidence.label || f.diagramEvidence.componentName || 'Visual check'}
                        </span>
                      </div>

                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 font-semibold block mb-0.5">
                          Code Evidence:
                        </span>
                        <span className="text-slate-300">
                          {f.implementationEvidence.summary}
                        </span>
                      </div>
                    </div>

                    {/* Code Reference Button */}
                    {f.implementationEvidence.references.length > 0 && (
                      <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-900">
                        <span className="font-mono text-[10px] text-slate-400">
                          {f.implementationEvidence.references[0].filePath}:
                          {f.implementationEvidence.references[0].lineNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => onInspectCode(f.implementationEvidence.references[0])}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          View Code Snippet
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  No findings in category "{activeCategory}" between these two snapshots.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved Snapshots List Management */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-xs font-semibold text-white mb-3">Saved Project Snapshots ({snapshots.length})</h3>
        {snapshots.length > 0 ? (
          <div className="divide-y divide-slate-800/60">
            {snapshots.map((s) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white">{s.versionLabel}</span>
                  <span className="text-slate-400 ml-2">({s.projectName})</span>
                  <span className="text-[11px] text-slate-500 ml-3">
                    {new Date(s.createdAt).toLocaleString()} · {s.session?.summary?.totalFindings ?? 0} findings
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteSnapshot(s.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete snapshot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No snapshots saved yet.</p>
        )}
      </div>
    </div>
  );
};
