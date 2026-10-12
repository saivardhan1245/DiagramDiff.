import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { LandingView } from './components/LandingView.js';
import { NewAnalysisModal } from './components/NewAnalysisModal.js';
import { ProcessingView } from './components/ProcessingView.js';
import { ResultsView } from './components/ResultsView.js';
import { TimelineView } from './components/TimelineView.js';
import { CodeModal } from './components/CodeModal.js';
import type { AnalysisSession, CodeReference } from './types/index.js';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'processing' | 'results' | 'timeline'>('landing');
  const [activeSession, setActiveSession] = useState<AnalysisSession | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStage, setProcessingStage] = useState('Checking input files...');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [modelName, setModelName] = useState('Gemma 4 (26B A4B IT)');
  const [lastSubmittedFormData, setLastSubmittedFormData] = useState<FormData | null>(null);
  const [hasSnapshots, setHasSnapshots] = useState(false);
  const [activeCodeRef, setActiveCodeRef] = useState<CodeReference | null>(null);

  // Check backend health and model status
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.model) {
          const shortName = data.model.replace('models/', '');
          setModelName(`Gemma 4 (${shortName})`);
        }
      })
      .catch((err) => {
        console.warn('Backend health check error:', err);
      });

    // Check if any snapshots exist
    fetch('/api/snapshots')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.snapshots) && data.snapshots.length > 0) {
          setHasSnapshots(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleStartAnalysis = (formData: FormData) => {
    setLastSubmittedFormData(formData);
    setIsModalOpen(false);
    setIsSubmitting(true);
    setError(null);
    setErrorDetails(null);
    setCurrentView('processing');

    setProcessingStage('Validating image and code files in memory...');

    const timer1 = setTimeout(() => {
      setProcessingStage('Reading architecture diagram with Gemma 4...');
    }, 1500);

    const timer2 = setTimeout(() => {
      setProcessingStage('Analyzing declared routes and connections in code...');
    }, 4500);

    const timer3 = setTimeout(() => {
      setProcessingStage('Comparing design with code to detect mismatches...');
    }, 7500);

    fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    })
      .then(async (res) => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.details || 'Analysis could not be completed.');
        }
        return data;
      })
      .then((data) => {
        if (data.success && data.session) {
          setActiveSession(data.session);
          setCurrentView('results');
        } else {
          throw new Error('Analysis response did not contain a valid session.');
        }
      })
      .catch((err) => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        setError(err.message || 'An unexpected error occurred during analysis.');
        if (err.cause || err.stack) {
          setErrorDetails(String(err));
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleRetry = () => {
    if (lastSubmittedFormData) {
      handleStartAnalysis(lastSubmittedFormData);
    } else {
      setIsModalOpen(true);
      setCurrentView('landing');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar
        onNewAnalysis={() => setIsModalOpen(true)}
        hasActiveSession={Boolean(activeSession)}
        onViewResults={() => setCurrentView('results')}
        onOpenTimeline={() => setCurrentView('timeline')}
        onResetToHome={() => setCurrentView('landing')}
        modelName={modelName}
      />

      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingView
            onStartAnalysis={() => setIsModalOpen(true)}
            onOpenTimeline={() => setCurrentView('timeline')}
            hasSnapshots={hasSnapshots}
          />
        )}

        {currentView === 'processing' && (
          <ProcessingView
            currentStage={processingStage}
            error={error}
            errorDetails={errorDetails}
            onRetry={handleRetry}
            onCancel={() => {
              setIsSubmitting(false);
              setCurrentView('landing');
              setIsModalOpen(true);
            }}
            modelName={modelName}
          />
        )}

        {currentView === 'results' && activeSession && (
          <ResultsView
            session={activeSession}
            onNewAnalysis={() => setIsModalOpen(true)}
            onOpenTimeline={() => setCurrentView('timeline')}
          />
        )}

        {currentView === 'timeline' && (
          <TimelineView
            currentSessionId={activeSession?.id}
            currentProjectName={activeSession?.projectName}
            onInspectCode={(ref) => setActiveCodeRef(ref)}
            onBackToResults={activeSession ? () => setCurrentView('results') : undefined}
            onNewAnalysis={() => setIsModalOpen(true)}
          />
        )}
      </main>

      {/* Code Inspection Modal for Timeline or Results */}
      {activeCodeRef && (
        <CodeModal
          isOpen={Boolean(activeCodeRef)}
          onClose={() => setActiveCodeRef(null)}
          reference={activeCodeRef}
          fullFileContent={
            activeSession?.projectEvidence.rawFilesSnippet[activeCodeRef.filePath]
          }
        />
      )}

      {/* New Analysis Modal */}
      <NewAnalysisModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleStartAnalysis}
        isSubmitting={isSubmitting}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">DiagramDiff</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>Does your code match your design?</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Powered by {modelName}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
