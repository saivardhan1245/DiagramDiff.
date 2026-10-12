export type FindingCategory =
  | 'diagram_component_not_in_files'
  | 'implementation_component_not_in_diagram'
  | 'unverified_or_mismatched_connection'
  | 'conflicting_configuration'
  | 'unexpected_external_dependency'
  | 'ambiguous_or_inconclusive';

export type FindingSeverity = 'critical' | 'warning' | 'info' | 'inconclusive';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'inconclusive';

export type UserFindingStatus = 'unresolved' | 'real_issue' | 'intentional';

export interface CodeReference {
  filePath: string;
  lineNumber?: number;
  snippet?: string;
  context?: string;
}

export interface ConnectionTrace {
  fromComponentName?: string;
  toComponentName?: string;
  fromComponentId?: string;
  toComponentId?: string;
  expectedConnection: string;
  foundEvidence: string;
  isConnectionHighlighted?: boolean;
}

export interface Finding {
  id: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: ConfidenceLevel;
  explanation: string;
  userStatus?: UserFindingStatus;
  connectionTrace?: ConnectionTrace;
  diagramEvidence: {
    componentName?: string;
    relationship?: string;
    label?: string;
    visualNote?: string;
  };
  implementationEvidence: {
    summary: string;
    references: CodeReference[];
  };
  suggestedVerificationStep: string;
}

export interface DiagramComponent {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'cache' | 'queue' | 'gateway' | 'external_service' | 'storage' | 'unknown';
  description?: string;
  technologies?: string[];
  bounds?: {
    x: number; // percentage 0-100
    y: number;
    width: number;
    height: number;
  };
  isAmbiguous?: boolean;
}

export interface DiagramConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  protocol?: string;
  isBidirectional?: boolean;
  isInconclusive?: boolean;
  highlighted?: boolean;
}

export interface DiagramExtractionResult {
  title?: string;
  summary: string;
  components: DiagramComponent[];
  connections: DiagramConnection[];
  ambiguities: string[];
}

export interface ExtractedRoute {
  method: string;
  path: string;
  filePath: string;
  lineNumber: number;
  handlerSnippet: string;
}

export interface ExtractedServiceCall {
  target: string;
  endpoint?: string;
  filePath: string;
  lineNumber: number;
  snippet: string;
}

export interface ExtractedDbConfig {
  type: string;
  hostOrUrl?: string;
  port?: number | string;
  filePath: string;
  lineNumber: number;
  snippet: string;
}

export interface ExtractedDockerService {
  name: string;
  image?: string;
  ports?: string[];
  environment?: string[];
  dependsOn?: string[];
  filePath: string;
  lineNumber: number;
}

export interface ProjectEvidence {
  fileInventory: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  routes: ExtractedRoute[];
  outboundCalls: ExtractedServiceCall[];
  databases: ExtractedDbConfig[];
  dockerServices: ExtractedDockerService[];
  entryPoints: Array<{ path: string; line: number }>;
  rawFilesSnippet: Record<string, string>; // sample lines for evidence viewing
}

export interface AnalysisSession {
  id: string;
  projectName: string;
  description?: string;
  createdAt: string;
  modelUsed: string;
  diagramImage: {
    mimeType: string;
    base64: string;
    fileName: string;
    sizeBytes: number;
  };
  diagramExtraction: DiagramExtractionResult;
  projectEvidence: ProjectEvidence;
  findings: Finding[];
  summary: {
    totalFindings: number;
    confirmedMismatches: number;
    unverifiedOrInconclusive: number;
    analyzedFilesCount: number;
  };
}

export interface Snapshot {
  id: string;
  versionLabel: string;
  projectName: string;
  createdAt: string;
  sessionId: string;
  session: AnalysisSession;
}

export interface DriftComparisonResult {
  baseSnapshot: { id: string; versionLabel: string; createdAt: string };
  targetSnapshot: { id: string; versionLabel: string; createdAt: string };
  newFindings: Finding[];
  fixedFindings: Finding[];
  unchangedFindings: Finding[];
  stats: {
    newCount: number;
    fixedCount: number;
    unchangedCount: number;
  };
}
