# DiagramDiff — Multimodal Architecture Consistency Checker

Built for the **Best Use of Gemma 4** hackathon.

DiagramDiff enables software engineering teams to verify whether their actual source code and infrastructure configuration adhere to their intended software architecture diagram.

Instead of generating mock code, speculative designs, or hallucinated claims, DiagramDiff uses **Gemma 4 multimodal reasoning** via the Google Gemini API in tandem with **deterministic static code parsers** to produce an evidence-backed architecture review with line-level traceability.

---

## Key Features

1. **Gemma 4 Multimodal Diagram Interpretation**:
   - Understands components, boundaries, arrows, protocols, and annotations from uploaded architecture diagrams (PNG, JPEG, WebP).
   - Detects visual ambiguities (unlabelled arrows, indistinct icons) instead of making unwarranted assumptions.
   - Primary verified model identifier: `models/gemma-4-26b-a4b-it`.

2. **Deterministic Implementation Evidence Extraction**:
   - Inspects real project files uploaded either as a ZIP archive or as individual files.
   - Parses declared HTTP routes, database configurations, and external SDKs.
   - Inspects `docker-compose.yml` and `Dockerfile` for declared services, exposed ports, and network links.
   - Extracts exact 1-indexed line numbers and context snippets for every observation.
   - Sandboxed in-memory parsing prevents code execution and blocks Zip-Slip path traversal. Automatically redacts and ignores `.env` files, secrets, binaries, and `node_modules`.

3. **Evidence-Backed Consistency Reasoning**:
   - Classifies findings into unambiguous categories:
     - `diagram_component_not_in_files`
     - `implementation_component_not_in_diagram`
     - `unverified_or_mismatched_connection`
     - `conflicting_configuration`
     - `unexpected_external_dependency`
     - `ambiguous_or_inconclusive`
   - Honest distinctions: Differentiates *"not found in supplied files"* from *"does not exist in the project"*, and marks unverified connections as *inconclusive* rather than confirmed defects.
   - Avoids fake percentages or synthetic accuracy scores.

4. **Trace the Broken Connection**:
   - Visually highlights mismatched or broken connections directly on the architecture diagram.
   - Points to the exact source file and line number supporting the finding.
   - Concisely explains the difference in 1-2 simple sentences.
   - Shows expected design connection alongside actual code evidence.
   - Allows marking findings as: *Real Issue*, *Intentional Difference*, or *Unresolved*.

5. **Architecture Drift Timeline**:
   - Saves real analysis snapshots (e.g. `v1.0`, `v2.0`).
   - Categorizes architectural drift into three distinct buckets:
     - **New**: Issues detected in the newer version.
     - **Fixed**: Previous issues no longer detected.
     - **Unchanged**: Issues still present across versions.
   - Side-by-side evidence inspection of diagrams and source code between versions.

6. **Report Export**:
   - Export analysis reports to Markdown (`.md`) for pull requests or documentation.
   - Export structured JSON (`.json`) with complete provenance.

---

## Architecture

```
[ User Architecture Diagram (PNG/JPEG/WebP) ]   [ Project Code / ZIP Archive ]
                    │                                         │
                    ▼                                         ▼
      Gemma 4 Multimodal Vision                 Deterministic Code Parsers
  (models/gemma-4-26b-a4b-it)                   (Routes, Ports, DBs, Docker)
                    │                                         │
                    └───────────────────┬─────────────────────┘
                                        │
                                        ▼
                         Consistency Reconciliation
                      (Cross-checks & Gemma Reasoning)
                                        │
                                        ▼
                         [ Evidence-Backed Report ]
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | **Required.** Google Gemini API key with access to Gemma 4 models. Injected automatically in AI Studio via Settings > Secrets. |
| `PORT` | Optional. Server port (defaults to `3000`). |

---

## Setup & Running (Windows PowerShell)

### Prerequisites
- Node.js v20+ or v22+
- npm v10+

### Step-by-Step Instructions

1. Clone or navigate to the repository directory:
```powershell
cd /path/to/diagramdiff
```

2. Copy environment variable example and set your API key:
```powershell
Copy-Item .env.example .env
# Edit .env and ensure GEMINI_API_KEY is populated
$env:GEMINI_API_KEY="your-gemini-api-key"
```

3. Install project dependencies:
```powershell
npm install
```

4. Run the development server (runs full-stack Express server with Vite middleware on port 3000):
```powershell
npm run dev
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

6. To compile and run the production build locally:
```powershell
npm run build
npm start
```

---

## Deploying to Render

DiagramDiff is fully configured for deployment on **Render** as a Node.js Web Service.

### Option A: 1-Click Blueprint (Recommended)
1. Push your repository to GitHub or GitLab.
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect this repository (Render will automatically detect the included `render.yaml`).
5. In the environment variables prompt, enter your `GEMINI_API_KEY`.
6. Click **Apply**. Render will build and deploy DiagramDiff automatically.

### Option B: Manual Web Service Setup
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Web Service**.
3. Connect your repository.
4. Configure the service settings:
   - **Environment:** `Node`
   - **Branch:** `main` (or your active branch)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. In the **Environment Variables** section, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
   - `NODE_ENV`: `production`
6. Click **Create Web Service**. Render will install dependencies, bundle the frontend and backend, and launch the service.

---

## Supported Inputs

- **Diagram Formats**: PNG, JPEG, WebP (up to 10MB).
- **Implementation Formats**:
  - Project `.zip` archive (up to 30MB; safely unpacked in memory).
  - Individual files: `package.json`, `tsconfig.json`, `docker-compose.yml`, `Dockerfile`, Express/Fastify/Koa route files, database connection modules, frontend API callers.
- **Excluded by Design**: `.env` files, credentials (`id_rsa`), `.git/`, `node_modules/`, binaries, videos, audio.

---

## Technical Limitations

- **Static Analysis Scope**: Static code analysis identifies declared endpoints, drivers, and configurations. Dynamic runtime behavior (e.g. dynamic reflection, runtime URLs constructed from external metadata servers) cannot be proven purely through static analysis and is classified as *inconclusive*.
- **Partial Repositories**: If only a subset of files from a polyrepo or monorepo is uploaded, components hosted elsewhere will be marked with *"not located in supplied files"* with a suggestion to verify external hosting rather than being flagged as broken code.
- **No Arbitrary Code Execution**: Uploaded files are strictly parsed as untrusted text. No scripts, npm scripts, or build hooks are executed.

---

## License

Apache-2.0
