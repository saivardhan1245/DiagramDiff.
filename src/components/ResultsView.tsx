import React, { useState } from 'react';
import {
  Download,
  Filter,
  Search,
  Layers,
  FileCode,
  Server,
  Database,
  Container,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Package,
  GitCompare,
  BookmarkPlus,
  Check,
} from 'lucide-react';
import type {
  AnalysisSession,
  Finding,
  CodeReference,
  ConnectionTrace,
  UserFindingStatus,
} from '../types/index.js';
import { DiagramViewer } from './DiagramViewer.js';
import { FindingCard } from './FindingCard.js';
import { CodeModal } from './CodeModal.js';
import { ExportModal } from './ExportModal.js';

interface ResultsViewProps {
  session: AnalysisSession;
  onNewAnalysis: () => void;
  onOpenTimeline?: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  session,
  onNewAnalysis,
  onOpenTimeline,
}) => {
  const [findings, setFindings] = useState<Finding[]>(session.findings);
  const [activeTab, setActiveTab] = useState<'findings' | 'evidence'>('findings');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  // Feature One: Active Connection Trace for DiagramViewer
  const [activeTrace, setActiveTrace] = useState<ConnectionTrace | null>(null);

  // Modals & Snapshot State
  const [activeCodeRef, setActiveCodeRef] = useState<CodeReference | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [snapshotVersion, setSnapshotVersion] = useState('v1.0');
  const [snapshotSaved, setSnapshotSaved] = useState(false);

  // Evidence subtab
  const [evidenceSubTab, setEvidenceSubTab] = useState<'files' | 'routes' | 'docker' | 'db' | 'deps'>('routes');

  // Handle User Decision (Real Issue, Intentional Difference, Unresolved)
  const handleStatusChange = async (findingId: string, status: UserFindingStatus) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, userStatus: status } : f))
    );

    try {
      await fetch(`/api/findings/${session.id}/${encodeURIComponent(findingId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error('Failed to update status on server:', e);
    }
  };

  // Handle Snapshot Save for Drift Timeline
  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotVersion.trim()) return;

    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          versionLabel: snapshotVersion.trim(),
        }),
      });
      if (res.ok) {
        setSnapshotSaved(true);
        setIsSavingSnapshot(false);
        setTimeout(() => setSnapshotSaved(false), 3000);
      }
    } catch (e) {
      console.error('Error saving snapshot:', e);
    }
  };

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    // Component filter from diagram
    if (selectedComponentId) {
      const comp = session.diagramExtraction.components.find((c) => c.id === selectedComponentId);
      if (comp) {
        const matchesComp =
          f.diagramEvidence.componentName?.toLowerCase().includes(comp.name.toLowerCase()) ||
          f.title.toLowerCase().includes(comp.name.toLowerCase()) ||
          f.explanation.toLowerCase().includes(comp.name.toLowerCase());
        if (!matchesComp) return false;
      }
    }

    // Category filter
    if (selectedCategory !== 'all' && f.category !== selectedCategory) {
      return false;
    }

    // Severity filter
    if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText =
        f.title.toLowerCase().includes(q) ||
        f.explanation.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.implementationEvidence.summary.toLowerCase().includes(q);
      if (!matchText) return false;
    }

    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Session Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {session.projectName}
              </h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                {session.modelUsed}
              </span>
            </div>
            {session.description && (
              <p className="mt-1 text-xs text-slate-400">{session.description}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <span>{new Date(session.createdAt).toLocaleDateString()}</span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span>{session.summary.analyzedFilesCount} implementation files analyzed</span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span>Diagram: {session.diagramImage.fileName}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Save snapshot button */}
            {isSavingSnapshot ? (
              <form onSubmit={handleSaveSnapshot} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={snapshotVersion}
                  onChange={(e) => setSnapshotVersion(e.target.value)}
                  placeholder="e.g. v1.0"
                  className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white w-24 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-500 cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingSnapshot(false)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsSavingSnapshot(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors cursor-pointer"
                title="Save as version snapshot for Architecture Drift Timeline"
              >
                {snapshotSaved ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5 text-indigo-400" />
                )}
                <span>{snapshotSaved ? 'Snapshot Saved!' : 'Save Snapshot'}</span>
              </button>
            )}

            {/* Drift Timeline Trigger */}
            {onOpenTimeline && (
              <button
                onClick={onOpenTimeline}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <GitCompare className="h-3.5 w-3.5 text-sky-400" />
                <span>Drift Timeline</span>
              </button>
            )}

            <button
              onClick={() => setIsExportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>

            <button
              onClick={onNewAnalysis}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              New Analysis
            </button>
          </div>
        </div>

        {/* Honest Metric Strip (No arbitrary scores) */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-800 pt-4">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">Total Observations</span>
            <span className="text-lg font-bold text-white mt-0.5 block">
              {findings.length}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] text-amber-400 block">Possible Mismatches</span>
            <span className="text-lg font-bold text-amber-300 mt-0.5 block">
              {findings.filter((f) => f.severity === 'critical' || f.severity === 'warning').length}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] text-sky-400 block">Inconclusive / Unverified</span>
            <span className="text-lg font-bold text-sky-300 mt-0.5 block">
              {findings.filter((f) => f.severity === 'inconclusive' || f.confidence === 'inconclusive').length}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] text-emerald-400 block">Marked Intentional</span>
            <span className="text-lg font-bold text-emerald-300 mt-0.5 block">
              {findings.filter((f) => f.userStatus === 'intentional').length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('findings')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'findings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Architecture Findings ({findings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'evidence'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileCode className="h-4 w-4" />
          <span>Extracted Code Evidence ({session.projectEvidence.fileInventory.length} Files)</span>
        </button>
      </div>

      {/* TAB 1: ARCHITECTURE FINDINGS */}
      {activeTab === 'findings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Diagram Viewer with Broken Connection Tracing */}
          <div className="lg:col-span-5 sticky top-20">
            <DiagramViewer
              imageBase64={session.diagramImage.base64}
              imageMimeType={session.diagramImage.mimeType}
              extraction={session.diagramExtraction}
              selectedComponentId={selectedComponentId}
              onSelectComponent={setSelectedComponentId}
              activeTrace={activeTrace}
              onClearTrace={() => setActiveTrace(null)}
            />

            {selectedComponentId && (
              <div className="mt-3 flex items-center justify-between text-xs bg-indigo-950/50 border border-indigo-800/50 p-2.5 rounded-lg text-indigo-200">
                <span>
                  Filtering for: <strong>{session.diagramExtraction.components.find((c) => c.id === selectedComponentId)?.name}</strong>
                </span>
                <button
                  onClick={() => setSelectedComponentId(null)}
                  className="text-xs text-indigo-400 hover:text-white underline cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Filter Bar & Findings List */}
          <div className="lg:col-span-7 space-y-4">
            {/* Filter controls */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search findings by keyword, path, or explanation..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Category & Severity Dropdowns */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Filter className="h-3.5 w-3.5 text-slate-500" />
                  <span>Category:</span>
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="diagram_component_not_in_files">Diagram Component Not in Files</option>
                  <option value="implementation_component_not_in_diagram">Code Component Not in Diagram</option>
                  <option value="unverified_or_mismatched_connection">Connection Mismatch / Unverified</option>
                  <option value="conflicting_configuration">Conflicting Configuration</option>
                  <option value="unexpected_external_dependency">Unexpected External Dependency</option>
                  <option value="ambiguous_or_inconclusive">Visual Ambiguity</option>
                </select>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
                  <span>Severity:</span>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="rounded border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="inconclusive">Inconclusive</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Findings List */}
            {filteredFindings.length > 0 ? (
              <div className="space-y-4">
                {filteredFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    onInspectCode={(ref) => setActiveCodeRef(ref)}
                    onStatusChange={(status) => handleStatusChange(finding.id, status)}
                    onFocusDiagramConnection={() => {
                      if (finding.connectionTrace) {
                        setActiveTrace(finding.connectionTrace);
                      }
                    }}
                    isHighlighted={
                      Boolean(
                        activeTrace &&
                        finding.connectionTrace?.expectedConnection === activeTrace.expectedConnection
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <HelpCircle className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-white">No matching findings</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Try adjusting your search query, component selection, or category filters.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedSeverity('all');
                    setSearchQuery('');
                    setSelectedComponentId(null);
                  }}
                  className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EXTRACTED CODE EVIDENCE EXPLORER */}
      {activeTab === 'evidence' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
            <button
              onClick={() => setEvidenceSubTab('routes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                evidenceSubTab === 'routes'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Server className="h-3.5 w-3.5" />
              <span>Declared Routes ({session.projectEvidence.routes.length})</span>
            </button>

            <button
              onClick={() => setEvidenceSubTab('docker')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                evidenceSubTab === 'docker'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Container className="h-3.5 w-3.5" />
              <span>Containers & Ports ({session.projectEvidence.dockerServices.length})</span>
            </button>

            <button
              onClick={() => setEvidenceSubTab('db')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                evidenceSubTab === 'db'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Database Drivers ({session.projectEvidence.databases.length})</span>
            </button>

            <button
              onClick={() => setEvidenceSubTab('deps')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                evidenceSubTab === 'deps'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Dependencies ({Object.keys(session.projectEvidence.dependencies).length})</span>
            </button>

            <button
              onClick={() => setEvidenceSubTab('files')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                evidenceSubTab === 'files'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>Analyzed File Inventory ({session.projectEvidence.fileInventory.length})</span>
            </button>
          </div>

          {/* Subtab Contents */}
          {evidenceSubTab === 'routes' && (
            <div>
              <h3 className="text-xs font-semibold text-white mb-3">HTTP Routes Detected in Source Files</h3>
              {session.projectEvidence.routes.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="p-3">Method</th>
                        <th className="p-3">Path</th>
                        <th className="p-3">File Location</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-slate-300">
                      {session.projectEvidence.routes.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-850">
                          <td className="p-3 font-semibold text-indigo-400">{r.method}</td>
                          <td className="p-3 text-white">{r.path}</td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {r.filePath}:{r.lineNumber}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() =>
                                setActiveCodeRef({
                                  filePath: r.filePath,
                                  lineNumber: r.lineNumber,
                                  snippet: r.handlerSnippet,
                                })
                              }
                              className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                            >
                              Inspect Code
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No explicit HTTP router handlers (e.g. app.get, router.post) detected in the analyzed files.
                </p>
              )}
            </div>
          )}

          {evidenceSubTab === 'docker' && (
            <div>
              <h3 className="text-xs font-semibold text-white mb-3">Docker Services & Ports</h3>
              {session.projectEvidence.dockerServices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {session.projectEvidence.dockerServices.map((ds, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-white">{ds.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{ds.filePath}</span>
                      </div>
                      {ds.image && <p className="text-slate-400 text-[11px]">Image: <span className="font-mono text-indigo-300">{ds.image}</span></p>}
                      <p className="text-slate-400 text-[11px] mt-1">
                        Ports: <span className="font-mono text-emerald-300">{ds.ports?.join(', ') || 'None exposed'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No docker-compose.yml or Dockerfile found in supplied files.</p>
              )}
            </div>
          )}

          {evidenceSubTab === 'db' && (
            <div>
              <h3 className="text-xs font-semibold text-white mb-3">Database Clients & Connections</h3>
              {session.projectEvidence.databases.length > 0 ? (
                <div className="space-y-2">
                  {session.projectEvidence.databases.map((db, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{db.type}</span>
                        {db.port && <span className="ml-2 font-mono text-indigo-300">(Port {db.port})</span>}
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {db.filePath}:{db.lineNumber}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setActiveCodeRef({
                            filePath: db.filePath,
                            lineNumber: db.lineNumber,
                            snippet: db.snippet,
                          })
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No explicit database connections detected in supplied files.</p>
              )}
            </div>
          )}

          {evidenceSubTab === 'deps' && (
            <div>
              <h3 className="text-xs font-semibold text-white mb-3">Declared Dependencies (package.json)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 font-mono text-xs">
                {Object.entries(session.projectEvidence.dependencies).map(([pkg, ver]) => (
                  <div key={pkg} className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="text-indigo-300 truncate">{pkg}</span>
                    <span className="text-slate-500 shrink-0 ml-2">{ver}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {evidenceSubTab === 'files' && (
            <div>
              <h3 className="text-xs font-semibold text-white mb-3">All Analyzed Implementation Files</h3>
              <div className="max-h-80 overflow-y-auto space-y-1 rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs">
                {session.projectEvidence.fileInventory.map((f, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 text-slate-300 hover:text-white">
                    <span>{f}</span>
                    <button
                      onClick={() =>
                        setActiveCodeRef({
                          filePath: f,
                          lineNumber: 1,
                          snippet: session.projectEvidence.rawFilesSnippet[f]?.slice(0, 500),
                        })
                      }
                      className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                    >
                      View Source
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Code Inspection Modal */}
      {activeCodeRef && (
        <CodeModal
          isOpen={Boolean(activeCodeRef)}
          onClose={() => setActiveCodeRef(null)}
          reference={activeCodeRef}
          fullFileContent={session.projectEvidence.rawFilesSnippet[activeCodeRef.filePath]}
        />
      )}

      {/* Export Modal */}
      {isExportOpen && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          session={session}
        />
      )}
    </div>
  );
};
