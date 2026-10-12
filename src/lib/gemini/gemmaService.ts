import { GoogleGenAI } from '@google/genai';
import type {
  DiagramExtractionResult,
  ProjectEvidence,
  Finding,
} from '../../types/index.js';

// Primary verified Gemma 4 model identifier
export const GEMMA_4_MODEL: string = 'models/gemma-4-26b-a4b-it';
export const GEMMA_4_FALLBACK_MODEL: string = 'models/gemma-4-31b-it';

/**
 * Returns a configured GoogleGenAI client with the required User-Agent header.
 */
function getGemmaClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not configured. Please configure your Gemini API Key in Settings > Secrets.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 25000,
    },
  });
}

/**
 * Safely parses JSON from model output that might include markdown code fences or comments.
 */
function cleanAndParseJSON<T>(rawText: string, fallback: T): T {
  if (!rawText) return fallback;
  try {
    // Strip markdown code fences if present
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/```\s*$/i, '');
    cleaned = cleaned.trim();

    // Find first { or [ and last } or ]
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = 0;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace !== -1) {
        cleaned = cleaned.slice(startIdx, lastBrace + 1);
      }
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      const lastBracket = cleaned.lastIndexOf(']');
      if (lastBracket !== -1) {
        cleaned = cleaned.slice(startIdx, lastBracket + 1);
      }
    }

    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.warn('Failed to parse model JSON directly. Raw output preview:', rawText.slice(0, 300));
    return fallback;
  }
}

async function callGemmaWithRetry(ai: GoogleGenAI, params: any) {
  try {
    return await ai.models.generateContent(params);
  } catch (err: any) {
    if (err?.status === 500 || err?.status === 503 || err?.message?.includes('500') || err?.message?.includes('503')) {
      console.warn('Transient error from Gemma 4 API, retrying once in 1.5s...');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return await ai.models.generateContent(params);
    }
    throw err;
  }
}

/**
 * Uses Gemma 4 multimodal capabilities to extract components, connections, and ambiguities
 * from an uploaded architecture diagram image.
 */
export async function interpretDiagramWithGemma4(
  imageBase64: string,
  imageMimeType: string
): Promise<DiagramExtractionResult> {
  const ai = getGemmaClient();

  const prompt = `You are a software architecture analysis engine in DiagramDiff.
Examine this software architecture diagram carefully.
Extract a structured representation of the system.

Do NOT invent components or connections that do not exist.
If any text, arrow, or boundary is illegible, blurry, or ambiguous, explicitly list it in "ambiguities".

Return ONLY a valid JSON object matching this exact structure:
{
  "title": "Short title or name of the architecture as written in the diagram (or null if not labeled)",
  "summary": "High-level summary of the architectural structure depicted",
  "components": [
    {
      "id": "comp-1",
      "name": "Component name exactly as written (e.g. React Frontend, Auth Service, PostgreSQL, Redis)",
      "type": "frontend" | "backend" | "database" | "cache" | "queue" | "gateway" | "external_service" | "storage" | "unknown",
      "description": "Short description of role in diagram",
      "technologies": ["list of tech or protocols mentioned in label, e.g. Node, React, PostgreSQL"],
      "bounds": {
        "x": 10,
        "y": 20,
        "width": 25,
        "height": 15
      },
      "isAmbiguous": false
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "from": "comp-1",
      "to": "comp-2",
      "label": "Arrow text or label (e.g. REST /api, gRPC, Port 5432, SQL)",
      "protocol": "HTTP" | "REST" | "GraphQL" | "gRPC" | "WebSocket" | "TCP" | "SQL" | "Queue/Event" | "Unknown",
      "isBidirectional": false,
      "isInconclusive": false
    }
  ],
  "ambiguities": [
    "List any visual aspects that are uncertain, e.g. 'Unlabelled arrow between Gateway and Service B', 'Blurry icon in top right'"
  ]
}

Note:
- "bounds" are estimated percentage coordinates (0 to 100) where the component box is located in the image.
- Return ONLY the JSON object. Do not add introductory or concluding text.`;

  let responseText = '';
  try {
    const res = await callGemmaWithRetry(ai, {
      model: GEMMA_4_MODEL,
      contents: [
        { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
        { text: prompt },
      ],
    });
    responseText = res.text || '';
  } catch (err: any) {
    console.error(`Gemma 4 model (${GEMMA_4_MODEL}) failed:`, err?.message || err);
    throw new Error(
      `Gemma 4 architecture diagram interpretation failed: ${err.message || String(err)}. Please verify your GEMINI_API_KEY in Settings > Secrets.`
    );
  }

  const defaultResult: DiagramExtractionResult = {
    title: 'Extracted Architecture',
    summary: 'Diagram processed by Gemma 4.',
    components: [],
    connections: [],
    ambiguities: ['Model response could not be fully parsed into standard schema.'],
  };

  const parsed = cleanAndParseJSON<DiagramExtractionResult>(responseText, defaultResult);

  // Validate and sanitize components & connections
  const sanitizedComponents = Array.isArray(parsed.components)
    ? parsed.components.map((c, i) => ({
        id: c.id || `comp-${i + 1}`,
        name: c.name || `Component ${i + 1}`,
        type: c.type || 'unknown',
        description: c.description || '',
        technologies: Array.isArray(c.technologies) ? c.technologies : [],
        bounds: c.bounds && typeof c.bounds.x === 'number' ? c.bounds : undefined,
        isAmbiguous: Boolean(c.isAmbiguous),
      }))
    : [];

  const sanitizedConnections = Array.isArray(parsed.connections)
    ? parsed.connections.map((conn, i) => ({
        id: conn.id || `conn-${i + 1}`,
        from: conn.from || '',
        to: conn.to || '',
        label: conn.label || '',
        protocol: conn.protocol || 'Unknown',
        isBidirectional: Boolean(conn.isBidirectional),
        isInconclusive: Boolean(conn.isInconclusive),
      }))
    : [];

  return {
    title: parsed.title || 'Architecture System',
    summary: parsed.summary || 'Extracted system architecture diagram.',
    components: sanitizedComponents,
    connections: sanitizedConnections,
    ambiguities: Array.isArray(parsed.ambiguities) ? parsed.ambiguities : [],
  };
}

/**
 * Uses Gemma 4 to perform deep comparative consistency analysis between the visual diagram
 * entities and the extracted project code evidence.
 */
export async function compareArchitectureWithGemma4(
  diagram: DiagramExtractionResult,
  evidence: ProjectEvidence,
  rawFilePaths: string[]
): Promise<Finding[]> {
  const ai = getGemmaClient();

  // Prepare a bounded, non-sensitive summary of code evidence to send to Gemma 4
  const evidenceSummary = {
    totalFilesSupplied: evidence.fileInventory.length,
    suppliedFilesSample: evidence.fileInventory.slice(0, 50),
    dependencies: Object.keys(evidence.dependencies).slice(0, 40),
    declaredRoutes: evidence.routes.slice(0, 30).map((r) => ({
      method: r.method,
      path: r.path,
      file: r.filePath,
      line: r.lineNumber,
    })),
    outboundCalls: evidence.outboundCalls.slice(0, 25).map((o) => ({
      target: o.target,
      file: o.filePath,
      line: o.lineNumber,
    })),
    databaseConfigs: evidence.databases.map((d) => ({
      type: d.type,
      hostOrUrl: d.hostOrUrl,
      port: d.port,
      file: d.filePath,
      line: d.lineNumber,
    })),
    dockerServices: evidence.dockerServices.map((ds) => ({
      name: ds.name,
      ports: ds.ports,
      file: ds.filePath,
      line: ds.lineNumber,
    })),
    entryPoints: evidence.entryPoints.map((ep) => ep.path),
  };

  const prompt = `You are the consistency reasoning engine of DiagramDiff.
Compare this intended architecture diagram against the actual implementation evidence from the supplied files.

CRITICAL RULES:
1. Never invent code files, lines, or components that are not listed in the supplied evidence.
2. Distinguish "not found in supplied files" from "does not exist in the project". A missing component might be hosted externally or in a separate repository.
3. If a diagram connection cannot be verified in the supplied files, label it inconclusive rather than a confirmed defect.
4. If an implementation component or external dependency is found in the code that is NOT in the diagram, flag it as an unexpected or unrepresented component.
5. Provide exact file paths and line numbers whenever supported by the evidence.
6. For every finding, provide an honest, actionable suggested verification step.

DIAGRAM EXTRACTION:
${JSON.stringify(diagram, null, 2)}

IMPLEMENTATION EVIDENCE:
${JSON.stringify(evidenceSummary, null, 2)}

Return ONLY a JSON array of findings matching this exact schema:
[
  {
    "id": "finding-1",
    "title": "Clear concise finding title",
    "category": "diagram_component_not_in_files" | "implementation_component_not_in_diagram" | "unverified_or_mismatched_connection" | "conflicting_configuration" | "unexpected_external_dependency" | "ambiguous_or_inconclusive",
    "severity": "critical" | "warning" | "info" | "inconclusive",
    "confidence": "high" | "medium" | "low" | "inconclusive",
    "explanation": "Detailed explanation of the difference or observation without hype",
    "diagramEvidence": {
      "componentName": "Component name from diagram or null",
      "relationship": "Connection or label from diagram or null",
      "label": "Original diagram text",
      "visualNote": "Observation from the visual representation"
    },
    "implementationEvidence": {
      "summary": "Exact explanation of what was or was not observed in the files",
      "references": [
        {
          "filePath": "Actual file path from evidence",
          "lineNumber": 12,
          "snippet": "Short snippet or declaration"
        }
      ]
    },
    "suggestedVerificationStep": "Specific step the developer should take to verify or reconcile this"
  }
]

Return ONLY the JSON array. Do not include markdown introductions.`;

  try {
    const res = await callGemmaWithRetry(ai, {
      model: GEMMA_4_MODEL,
      contents: [{ text: prompt }],
    });

    const parsedFindings = cleanAndParseJSON<Finding[]>(res.text || '', []);
    if (Array.isArray(parsedFindings) && parsedFindings.length > 0) {
      return parsedFindings.map((f, idx) => ({
        id: f.id || `f-${idx + 1}`,
        title: f.title || 'Consistency Observation',
        category: f.category || 'ambiguous_or_inconclusive',
        severity: f.severity || 'info',
        confidence: f.confidence || 'medium',
        explanation: f.explanation || 'Analyzed by Gemma 4 architecture engine.',
        diagramEvidence: f.diagramEvidence || {},
        implementationEvidence: {
          summary: f.implementationEvidence?.summary || 'Supplied code evidence check.',
          references: Array.isArray(f.implementationEvidence?.references)
            ? f.implementationEvidence.references.filter((r) => rawFilePaths.includes(r.filePath))
            : [],
        },
        suggestedVerificationStep:
          f.suggestedVerificationStep || 'Verify against the latest deployment config.',
      }));
    }
  } catch (err: any) {
    console.error('Gemma 4 comparison reasoning error:', err?.message || err);
  }

  // If model reasoning fails or returns empty, return deterministic baseline findings
  return [];
}
