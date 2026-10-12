import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileCode,
  Image as ImageIcon,
  AlertTriangle,
  FolderArchive,
  Files,
  FileText,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface NewAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isSubmitting: boolean;
}

export const NewAnalysisModal: React.FC<NewAnalysisModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [diagramFile, setDiagramFile] = useState<File | null>(null);
  const [diagramPreview, setDiagramPreview] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'zip' | 'files'>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [individualFiles, setIndividualFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const diagramInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDiagramChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMessage(`Unsupported format: ${file.type || 'unknown'}. Please upload PNG, JPEG, or WebP.`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Diagram image exceeds 10MB limit. Please upload a smaller image.');
      return;
    }

    setDiagramFile(file);
    const reader = new FileReader();
    reader.onload = () => setDiagramPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMessage('Please select a valid .zip archive.');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      setErrorMessage('ZIP archive exceeds 30MB limit. Please exclude large assets or dependencies.');
      return;
    }

    setZipFile(file);
  };

  const handleIndividualFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    let totalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalSize += file.size;
      newFiles.push(file);
    }

    if (totalSize > 20 * 1024 * 1024) {
      setErrorMessage('Total size of selected files exceeds 20MB.');
      return;
    }

    setIndividualFiles((prev) => [...prev, ...newFiles]);
  };

  const removeIndividualFile = (index: number) => {
    setIndividualFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!projectName.trim()) {
      setErrorMessage('Please specify a project name.');
      return;
    }

    if (!diagramFile) {
      setErrorMessage('Please upload an architecture diagram image.');
      return;
    }

    if (inputMode === 'zip' && !zipFile) {
      setErrorMessage('Please upload a project ZIP archive.');
      return;
    }

    if (inputMode === 'files' && individualFiles.length === 0) {
      setErrorMessage('Please select at least one implementation file (e.g. package.json, routes, docker-compose).');
      return;
    }

    const formData = new FormData();
    formData.append('projectName', projectName.trim());
    formData.append('description', description.trim());
    formData.append('diagram', diagramFile);

    if (inputMode === 'zip' && zipFile) {
      formData.append('zip', zipFile);
    } else if (inputMode === 'files') {
      individualFiles.forEach((file) => {
        formData.append('files', file, file.name);
      });
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 my-8 text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">New Architecture Analysis</h2>
            <p className="text-xs text-slate-400">
              Provide your architecture diagram and actual code implementation
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-950/50 border border-rose-800/60 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Project Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Project Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Order Processing Platform"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Node + PostgreSQL + Redis"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Diagram Upload */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                1. Architecture Diagram <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500">PNG, JPEG, WebP (max 10MB)</span>
            </div>

            {diagramPreview ? (
              <div className="relative rounded-lg border border-slate-800 bg-slate-950 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={diagramPreview}
                    alt="Diagram Preview"
                    className="h-14 w-20 object-cover rounded border border-slate-800 bg-slate-900"
                  />
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-white truncate">{diagramFile?.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {(diagramFile!.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDiagramFile(null);
                    setDiagramPreview(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-md transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => diagramInputRef.current?.click()}
                className="group flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-6 hover:border-indigo-500/50 hover:bg-slate-950 transition-all cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-slate-400 group-hover:text-indigo-400 mb-2 transition-colors">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-slate-300 group-hover:text-white">
                  Click to select architecture diagram image
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Upload an architecture schematic, C4 model, or design chart
                </p>
              </div>
            )}
            <input
              ref={diagramInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleDiagramChange}
              className="hidden"
            />
          </div>

          {/* Implementation Files Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-300">
                2. Project Implementation Files <span className="text-rose-400">*</span>
              </label>

              {/* Mode switch */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800">
                <button
                  type="button"
                  onClick={() => setInputMode('zip')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    inputMode === 'zip'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Project ZIP
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('files')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    inputMode === 'files'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Selected Files
                </button>
              </div>
            </div>

            {inputMode === 'zip' ? (
              <div>
                {zipFile ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="h-10 w-10 rounded bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
                        <FolderArchive className="h-5 w-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-medium text-white truncate">{zipFile.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {(zipFile.size / (1024 * 1024)).toFixed(2)} MB archive
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setZipFile(null)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-md transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => zipInputRef.current?.click()}
                    className="group flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-6 hover:border-indigo-500/50 hover:bg-slate-950 transition-all cursor-pointer"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-slate-400 group-hover:text-indigo-400 mb-2 transition-colors">
                      <FolderArchive className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-slate-300 group-hover:text-white">
                      Click to select project .ZIP archive
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Max 30MB. Automatically unpacks in memory without running code.
                    </p>
                  </div>
                )}
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleZipChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div>
                <div
                  onClick={() => filesInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-4 hover:border-indigo-500/50 hover:bg-slate-950 transition-all cursor-pointer"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-slate-400 group-hover:text-indigo-400 mb-1 transition-colors">
                    <Files className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-300 group-hover:text-white">
                    Select code files (package.json, routes, docker-compose, etc.)
                  </p>
                </div>
                <input
                  ref={filesInputRef}
                  type="file"
                  multiple
                  onChange={handleIndividualFilesChange}
                  className="hidden"
                />

                {individualFiles.length > 0 && (
                  <div className="mt-3 max-h-36 overflow-y-auto space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    {individualFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/60 text-slate-300"
                      >
                        <span className="truncate max-w-[400px] font-mono text-[11px]">
                          {file.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeIndividualFile(idx)}
                            className="text-slate-400 hover:text-rose-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Security Notice */}
            <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
              <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Untrusted Execution Guard:</strong> Files are parsed as plain text in memory.
                No dependencies are installed, scripts executed, or environment credentials saved.
                <code className="text-slate-300 ml-1">.env</code> files and binaries are automatically ignored.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Checking Architecture...' : 'Check My Architecture'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
