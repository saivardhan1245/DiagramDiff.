import express from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { extractProjectEvidence, UploadedFileItem } from './src/lib/analyzer/codeExtractor.js';
import {
  interpretDiagramWithGemma4,
  GEMMA_4_MODEL,
} from './src/lib/gemini/gemmaService.js';
import { reconcileArchitecture } from './src/lib/analyzer/comparator.js';
import fs from 'fs';
import type { AnalysisSession, Finding, Snapshot, DriftComparisonResult, UserFindingStatus } from './src/types/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// In-memory sessions store
const sessions = new Map<string, AnalysisSession>();

// Persistent snapshots store
const SNAPSHOTS_FILE = path.resolve(__dirname, 'snapshots_store.json');
const snapshots = new Map<string, Snapshot>();

// Load persisted snapshots on boot
try {
  if (fs.existsSync(SNAPSHOTS_FILE)) {
    const raw = fs.readFileSync(SNAPSHOTS_FILE, 'utf-8');
    const parsed: Snapshot[] = JSON.parse(raw);
    for (const snap of parsed) {
      snapshots.set(snap.id, snap);
      // also seed session if not present
      if (snap.session && snap.sessionId) {
        sessions.set(snap.sessionId, snap.session);
      }
    }
  }
} catch (e) {
  console.warn('Could not read existing snapshots file:', e);
}

function persistSnapshots() {
  try {
    const list = Array.from(snapshots.values());
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write snapshots file:', e);
  }
}

// Setup multer memory storage (untrusted data is handled purely in RAM)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB max
  },
  fileFilter: (_req, file, cb) => {
    // Check field names
    if (file.fieldname === 'diagram') {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported diagram format: ${file.mimetype}. Allowed: PNG, JPEG, WebP`));
      }
    } else {
      cb(null, true);
    }
  },
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'healthy',
    model: GEMMA_4_MODEL,
    hasApiKey: hasKey,
    timestamp: new Date().toISOString(),
  });
});

// Analysis execution endpoint
app.post(
  '/api/analyze',
  upload.fields([
    { name: 'diagram', maxCount: 1 },
    { name: 'zip', maxCount: 1 },
    { name: 'files', maxCount: 60 },
  ]),
  async (req, res): Promise<void> => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const diagramFile = files?.['diagram']?.[0];
      const zipFile = files?.['zip']?.[0];
      const individualFiles = files?.['files'] || [];
      const projectName = (req.body.projectName as string) || 'Architecture Check';
      const description = (req.body.description as string) || '';

      // 1. Validation
      if (!diagramFile) {
        res.status(400).json({ error: 'Please upload an architecture diagram image (PNG, JPEG, WebP).' });
        return;
      }

      if (!zipFile && individualFiles.length === 0) {
        res.status(400).json({
          error: 'Please supply implementation files. Provide either a project ZIP or individual source files.',
        });
        return;
      }

      // 2. Process Code Files (safe in-memory extraction)
      const codeFiles: UploadedFileItem[] = [];
      const ignoredExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.mp4', '.mp3',
        '.pdf', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.eot',
        '.exe', '.bin', '.pyc', '.class', '.o', '.so', '.dylib', '.dll'
      ];
      const ignoredDirectories = ['node_modules', '.git', '.github', 'dist', 'build', '.next', '.cache', 'coverage'];

      if (zipFile) {
        try {
          const zip = await JSZip.loadAsync(zipFile.buffer);
          for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;

            // Security: Prevent Zip-Slip directory traversal
            const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
            if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
              continue;
            }

            // Exclude directories
            const parts = normalized.split(/[/\\]/);
            if (parts.some((p) => ignoredDirectories.includes(p))) {
              continue;
            }

            // Exclude sensitive or binary files
            const ext = path.extname(normalized).toLowerCase();
            const fileName = path.basename(normalized).toLowerCase();
            if (fileName.startsWith('.env') || fileName === 'id_rsa' || fileName === 'id_ed25519') {
              continue;
            }
            if (ignoredExtensions.includes(ext)) {
              continue;
            }

            // Read text content up to 250KB per file
            const content = await zipEntry.async('string');
            if (content.length > 500000) continue; // skip oversized files

            codeFiles.push({
              path: normalized,
              content,
            });
          }
        } catch (zipErr: any) {
          res.status(400).json({
            error: `Failed to unpack uploaded ZIP archive: ${zipErr.message || 'Malformed archive'}. Please check archive format.`,
          });
          return;
        }
      }

      // Add individual uploaded files
      for (const f of individualFiles) {
        const normalized = path.normalize(f.originalname).replace(/^(\.\.(\/|\\|$))+/, '');
        const ext = path.extname(normalized).toLowerCase();
        const base = path.basename(normalized).toLowerCase();
        if (base.startsWith('.env')) continue;
        if (ignoredExtensions.includes(ext)) continue;

        const content = f.buffer.toString('utf-8');
        codeFiles.push({
          path: normalized,
          content,
        });
      }

      if (codeFiles.length === 0) {
        res.status(400).json({
          error: 'No readable source or configuration files found in the upload after filtering binaries and excluded folders.',
        });
        return;
      }

      // 3. Extract deterministic implementation evidence
      const projectEvidence = extractProjectEvidence(codeFiles);

      // 4. Multimodal reasoning with Gemma 4 on the architecture diagram
      const diagramBase64 = diagramFile.buffer.toString('base64');
      const diagramMime = diagramFile.mimetype;

      let diagramExtraction;
      try {
        diagramExtraction = await interpretDiagramWithGemma4(diagramBase64, diagramMime);
      } catch (gemmaErr: any) {
        res.status(502).json({
          error: `Gemma 4 diagram analysis failed: ${gemmaErr.message}`,
          instructions: 'Ensure GEMINI_API_KEY is properly set in Settings > Secrets.',
        });
        return;
      }

      // 5. Compare diagram with deterministic code evidence
      const findings = await reconcileArchitecture(diagramExtraction, projectEvidence);

      // 6. Assemble AnalysisSession
      const sessionId = `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const confirmedMismatches = findings.filter(
        (f) => f.severity === 'critical' || f.severity === 'warning'
      ).length;
      const unverifiedOrInconclusive = findings.filter(
        (f) => f.severity === 'inconclusive' || f.confidence === 'inconclusive'
      ).length;

      const session: AnalysisSession = {
        id: sessionId,
        projectName,
        description,
        createdAt: new Date().toISOString(),
        modelUsed: GEMMA_4_MODEL,
        diagramImage: {
          mimeType: diagramMime,
          base64: diagramBase64,
          fileName: diagramFile.originalname,
          sizeBytes: diagramFile.size,
        },
        diagramExtraction,
        projectEvidence,
        findings,
        summary: {
          totalFindings: findings.length,
          confirmedMismatches,
          unverifiedOrInconclusive,
          analyzedFilesCount: projectEvidence.fileInventory.length,
        },
      };

      sessions.set(sessionId, session);

      res.json({
        success: true,
        session,
      });
    } catch (err: any) {
      console.error('Analysis error:', err);
      res.status(500).json({
        error: 'An internal error occurred during architecture analysis.',
        details: err?.message || 'Unknown server error',
      });
    }
  }
);

// Get session by ID
app.get('/api/session/:id', (req, res): void => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired.' });
    return;
  }
  res.json({ success: true, session });
});

// Update finding user status (Feature One: Real Issue / Intentional / Unresolved)
app.patch('/api/findings/:sessionId/:findingId/status', (req, res): void => {
  const { sessionId, findingId } = req.params;
  const { status } = req.body as { status: UserFindingStatus };

  if (!['unresolved', 'real_issue', 'intentional'].includes(status)) {
    res.status(400).json({ error: 'Invalid status. Allowed: unresolved, real_issue, intentional' });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const finding = session.findings.find((f) => f.id === findingId);
  if (!finding) {
    res.status(404).json({ error: 'Finding not found' });
    return;
  }

  finding.userStatus = status;

  // If in any snapshots, update them too
  for (const snap of snapshots.values()) {
    if (snap.sessionId === sessionId) {
      const snapFinding = snap.session.findings.find((f) => f.id === findingId);
      if (snapFinding) snapFinding.userStatus = status;
    }
  }
  persistSnapshots();

  res.json({ success: true, finding });
});

// Feature Two: Architecture Drift Timeline Endpoints
// List all saved snapshots
app.get('/api/snapshots', (_req, res): void => {
  const list = Array.from(snapshots.values()).map((s) => ({
    id: s.id,
    versionLabel: s.versionLabel,
    projectName: s.projectName,
    createdAt: s.createdAt,
    sessionId: s.sessionId,
    summary: s.session.summary,
  }));
  res.json({ success: true, snapshots: list });
});

// Save a session as a snapshot
app.post('/api/snapshots', (req, res): void => {
  const { sessionId, versionLabel } = req.body as { sessionId: string; versionLabel: string };

  if (!sessionId || !versionLabel?.trim()) {
    res.status(400).json({ error: 'Please provide sessionId and a version label (e.g. v1.0).' });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found. Perform an analysis first before creating a snapshot.' });
    return;
  }

  const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const snapshot: Snapshot = {
    id: snapshotId,
    versionLabel: versionLabel.trim(),
    projectName: session.projectName,
    createdAt: new Date().toISOString(),
    sessionId: session.id,
    session: JSON.parse(JSON.stringify(session)), // clone session
  };

  snapshots.set(snapshotId, snapshot);
  persistSnapshots();

  res.json({ success: true, snapshot });
});

// Delete a snapshot
app.delete('/api/snapshots/:id', (req, res): void => {
  const id = req.params.id;
  if (!snapshots.has(id)) {
    res.status(404).json({ error: 'Snapshot not found' });
    return;
  }
  snapshots.delete(id);
  persistSnapshots();
  res.json({ success: true, message: 'Snapshot deleted' });
});

// Compare two snapshots to compute real Architecture Drift Timeline
app.post('/api/snapshots/compare', (req, res): void => {
  const { baseSnapshotId, targetSnapshotId } = req.body as {
    baseSnapshotId: string;
    targetSnapshotId: string;
  };

  if (!baseSnapshotId || !targetSnapshotId) {
    res.status(400).json({ error: 'Please specify both baseSnapshotId and targetSnapshotId to compare.' });
    return;
  }

  const baseSnap = snapshots.get(baseSnapshotId);
  const targetSnap = snapshots.get(targetSnapshotId);

  if (!baseSnap || !targetSnap) {
    res.status(404).json({ error: 'One or both requested snapshots were not found.' });
    return;
  }

  const baseFindings = baseSnap.session.findings || [];
  const targetFindings = targetSnap.session.findings || [];

  // Match key: title + category
  const makeKey = (f: Finding) => `${f.category}:::${f.title.toLowerCase().trim()}`;
  const baseKeys = new Map(baseFindings.map((f) => [makeKey(f), f]));
  const targetKeys = new Map(targetFindings.map((f) => [makeKey(f), f]));

  const newFindings: Finding[] = [];
  const fixedFindings: Finding[] = [];
  const unchangedFindings: Finding[] = [];

  // 1. New: In target, but NOT in base
  for (const [key, tf] of targetKeys.entries()) {
    if (!baseKeys.has(key)) {
      newFindings.push(tf);
    } else {
      unchangedFindings.push(tf);
    }
  }

  // 2. Fixed: In base, but NO LONGER in target
  for (const [key, bf] of baseKeys.entries()) {
    if (!targetKeys.has(key)) {
      fixedFindings.push(bf);
    }
  }

  const comparison: DriftComparisonResult = {
    baseSnapshot: {
      id: baseSnap.id,
      versionLabel: baseSnap.versionLabel,
      createdAt: baseSnap.createdAt,
    },
    targetSnapshot: {
      id: targetSnap.id,
      versionLabel: targetSnap.versionLabel,
      createdAt: targetSnap.createdAt,
    },
    newFindings,
    fixedFindings,
    unchangedFindings,
    stats: {
      newCount: newFindings.length,
      fixedCount: fixedFindings.length,
      unchangedCount: unchangedFindings.length,
    },
  };

  res.json({
    success: true,
    comparison,
    baseSession: baseSnap.session,
    targetSession: targetSnap.session,
  });
});

app.get('/api/export/:id/:format', (req, res): void => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found for export.' });
    return;
  }

  const format = req.params.format.toLowerCase();
  const safeName = session.projectName.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_diagramdiff.json"`);
    res.send(JSON.stringify(session, null, 2));
    return;
  }

  if (format === 'markdown' || format === 'md') {
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_diagramdiff.md"`);

    const md = generateMarkdownReport(session);
    res.send(md);
    return;
  }

  res.status(400).json({ error: 'Unsupported format. Supported: json, markdown' });
});

function generateMarkdownReport(session: AnalysisSession): string {
  const lines: string[] = [
    `# DiagramDiff Architecture Consistency Report: ${session.projectName}`,
    `\n**Date:** ${new Date(session.createdAt).toUTCString()}`,
    `**Model:** ${session.modelUsed}`,
    `**Files Analyzed:** ${session.summary.analyzedFilesCount}`,
    `**Total Findings:** ${session.summary.totalFindings}`,
    `**Potential Mismatches:** ${session.summary.confirmedMismatches}`,
    `**Inconclusive / Unverified:** ${session.summary.unverifiedOrInconclusive}`,
    `\n---\n`,
    `## 1. Intended Architecture Summary (Visual Extraction)`,
    `\n${session.diagramExtraction.summary}\n`,
    `### Extracted Components (${session.diagramExtraction.components.length})`,
  ];

  session.diagramExtraction.components.forEach((c) => {
    lines.push(`- **${c.name}** (${c.type}): ${c.description || 'No description'}`);
  });

  lines.push(`\n### Extracted Connections (${session.diagramExtraction.connections.length})`);
  session.diagramExtraction.connections.forEach((conn) => {
    lines.push(`- ${conn.from} ➔ ${conn.to} [Protocol: ${conn.protocol || 'Unspecified'}, Label: ${conn.label || 'None'}]`);
  });

  if (session.diagramExtraction.ambiguities.length > 0) {
    lines.push(`\n### Visual Ambiguities Noted`);
    session.diagramExtraction.ambiguities.forEach((amb) => {
      lines.push(`- ⚠️ ${amb}`);
    });
  }

  lines.push(`\n---\n`, `## 2. Evidence-Backed Findings`);

  if (session.findings.length === 0) {
    lines.push(`\nNo architecture discrepancies identified between the supplied files and diagram.\n`);
  } else {
    session.findings.forEach((f, idx) => {
      lines.push(`\n### ${idx + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
      lines.push(`- **Category:** \`${f.category}\``);
      lines.push(`- **Confidence:** ${f.confidence}`);
      lines.push(`- **Explanation:** ${f.explanation}`);
      if (f.diagramEvidence.label || f.diagramEvidence.componentName) {
        lines.push(`- **Diagram Evidence:** ${f.diagramEvidence.componentName || ''} - ${f.diagramEvidence.label || f.diagramEvidence.visualNote || ''}`);
      }
      lines.push(`- **Implementation Evidence:** ${f.implementationEvidence.summary}`);
      if (f.implementationEvidence.references.length > 0) {
        f.implementationEvidence.references.forEach((r) => {
          lines.push(`  - \`${r.filePath}${r.lineNumber ? `:${r.lineNumber}` : ''}\`: ${r.snippet || ''}`);
        });
      }
      lines.push(`- **Suggested Verification:** ${f.suggestedVerificationStep}`);
    });
  }

  lines.push(`\n---\n*Generated by DiagramDiff using Gemma 4 multimodal architecture reasoning.*`);
  return lines.join('\n');
}

// Dev & Production Vite Middleware Mounting
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.resolve(process.cwd(), 'dist'))
      ? path.resolve(process.cwd(), 'dist')
      : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DiagramDiff server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
