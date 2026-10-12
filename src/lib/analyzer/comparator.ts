import type {
  DiagramExtractionResult,
  ProjectEvidence,
  Finding,
  FindingCategory,
} from '../../types/index.js';
import { compareArchitectureWithGemma4 } from '../gemini/gemmaService.js';

/**
 * Reconciles diagram components and connections with static code evidence,
 * leveraging both deterministic rule verification and Gemma 4 multimodal reasoning.
 */
export async function reconcileArchitecture(
  diagram: DiagramExtractionResult,
  evidence: ProjectEvidence
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const fileSet = new Set(evidence.fileInventory);

  // Helper to find component by ID or Name
  const findComp = (idOrName: string) =>
    diagram.components.find(
      (c) =>
        c.id.toLowerCase() === idOrName.toLowerCase() ||
        c.name.toLowerCase() === idOrName.toLowerCase()
    );

  // 1. Feature One: Trace Broken Connections & Route Mismatches
  // Check for endpoint or path mentions in diagram connections or labels
  for (const conn of diagram.connections) {
    const fromComp = findComp(conn.from)?.name || conn.from;
    const toComp = findComp(conn.to)?.name || conn.to;
    const label = conn.label || '';

    // Extract path pattern like /api/... or /orders or /users from connection label
    const pathMatch = label.match(/\/(?:[a-zA-Z0-9_\-\/]+)/);
    if (pathMatch) {
      const expectedPath = pathMatch[0].replace(/\/+$/, '');
      const expectedBase = expectedPath.split('/').filter(Boolean).pop()?.toLowerCase();

      // Look for route in implementation
      const exactMatch = evidence.routes.find((r) => r.path === expectedPath);

      if (!exactMatch && expectedBase) {
        // Look for near match: singular vs plural, or missing prefix (e.g. /api/order vs /api/orders)
        const nearMatch = evidence.routes.find((r) => {
          const rBase = r.path.split('/').filter(Boolean).pop()?.toLowerCase();
          if (!rBase) return false;
          return (
            (expectedBase.endsWith('s') && expectedBase.slice(0, -1) === rBase) ||
            (rBase.endsWith('s') && rBase.slice(0, -1) === expectedBase) ||
            r.path.includes(expectedBase) ||
            expectedPath.includes(rBase)
          );
        });

        if (nearMatch) {
          findings.push({
            id: `conn-mismatch-${conn.id}`,
            title: `Endpoint mismatch between diagram and implementation`,
            category: 'unverified_or_mismatched_connection',
            severity: 'warning',
            confidence: 'high',
            userStatus: 'unresolved',
            explanation: `Your diagram uses ${expectedPath}, but the supplied backend defines ${nearMatch.path}. Check whether this is intentional.`,
            connectionTrace: {
              fromComponentName: fromComp,
              toComponentName: toComp,
              fromComponentId: conn.from,
              toComponentId: conn.to,
              expectedConnection: `Expected ${expectedPath} between ${fromComp} and ${toComp}`,
              foundEvidence: `Defined as ${nearMatch.method} ${nearMatch.path} in ${nearMatch.filePath}:${nearMatch.lineNumber}`,
              isConnectionHighlighted: true,
            },
            diagramEvidence: {
              relationship: `${fromComp} ➔ ${toComp}`,
              label: conn.label || expectedPath,
              visualNote: `Arrow labeled with ${expectedPath}`,
            },
            implementationEvidence: {
              summary: `Route ${nearMatch.path} located at ${nearMatch.filePath}:${nearMatch.lineNumber}.`,
              references: [
                {
                  filePath: nearMatch.filePath,
                  lineNumber: nearMatch.lineNumber,
                  snippet: nearMatch.handlerSnippet,
                },
              ],
            },
            suggestedVerificationStep: `Update either the code endpoint in ${nearMatch.filePath}:${nearMatch.lineNumber} or the diagram arrow label to maintain consistency.`,
          });
          continue;
        }
      }
    }
  }

  // 2. Deterministic Rule Check: Diagram Database components vs Code Evidence
  const dbComponents = diagram.components.filter((c) => c.type === 'database' || c.type === 'cache');
  for (const dbComp of dbComponents) {
    const compNameLower = dbComp.name.toLowerCase();
    const isRedis = compNameLower.includes('redis');
    const isPostgres = compNameLower.includes('postgres') || compNameLower.includes('pg');
    const isMongo = compNameLower.includes('mongo');
    const isMysql = compNameLower.includes('mysql');

    // Check if matching driver exists in package.json or db configs or docker-compose
    const matchedDbConfig = evidence.databases.find((d) =>
      d.type.toLowerCase().includes(compNameLower) ||
      (isRedis && d.type.toLowerCase().includes('redis')) ||
      (isPostgres && d.type.toLowerCase().includes('postgres')) ||
      (isMongo && d.type.toLowerCase().includes('mongo')) ||
      (isMysql && d.type.toLowerCase().includes('mysql'))
    );

    const matchedDocker = evidence.dockerServices.find((ds) =>
      ds.name.toLowerCase().includes(compNameLower) ||
      (ds.image && ds.image.toLowerCase().includes(compNameLower))
    );

    const hasDependency = Object.keys(evidence.dependencies).some((dep) =>
      (isRedis && dep.includes('redis')) ||
      (isPostgres && (dep.includes('pg') || dep.includes('postgres'))) ||
      (isMongo && (dep.includes('mongo') || dep.includes('mongoose'))) ||
      (isMysql && dep.includes('mysql'))
    );

    if (!matchedDbConfig && !matchedDocker && !hasDependency) {
      findings.push({
        id: `det-db-${dbComp.id}`,
        title: `Diagram database "${dbComp.name}" not located in supplied implementation files`,
        category: 'diagram_component_not_in_files',
        severity: 'warning',
        confidence: 'medium',
        userStatus: 'unresolved',
        explanation: `The diagram depicts a database service named "${dbComp.name}", but no driver or config was found in supplied files. Check whether this is intentional or hosted externally.`,
        connectionTrace: {
          toComponentName: dbComp.name,
          toComponentId: dbComp.id,
          expectedConnection: `Expected ${dbComp.name} database client or container`,
          foundEvidence: `No client or configuration found across ${evidence.fileInventory.length} uploaded files.`,
          isConnectionHighlighted: true,
        },
        diagramEvidence: {
          componentName: dbComp.name,
          label: dbComp.description || dbComp.name,
          visualNote: `Visual component identified as ${dbComp.type}`,
        },
        implementationEvidence: {
          summary: `Searched ${evidence.fileInventory.length} files. No matching driver, URI, or docker-compose service found for ${dbComp.name}.`,
          references: [],
        },
        suggestedVerificationStep: `Check if "${dbComp.name}" is hosted externally (e.g. AWS RDS) or if connection files were omitted.`,
      });
    } else if (matchedDocker && matchedDbConfig) {
      // Check for port discrepancy
      const dockerPort = matchedDocker.ports?.[0]?.split(':')[0];
      if (dockerPort && matchedDbConfig.port && String(dockerPort) !== String(matchedDbConfig.port)) {
        findings.push({
          id: `det-port-mismatch-${dbComp.id}`,
          title: `Conflicting port configuration for ${dbComp.name}`,
          category: 'conflicting_configuration',
          severity: 'critical',
          confidence: 'high',
          userStatus: 'unresolved',
          explanation: `Your diagram or container specifies port ${dockerPort}, but your application client references port ${matchedDbConfig.port}. Check whether this port mismatch is intentional.`,
          connectionTrace: {
            toComponentName: dbComp.name,
            toComponentId: dbComp.id,
            expectedConnection: `Port ${dockerPort} defined in ${matchedDocker.filePath}`,
            foundEvidence: `Port ${matchedDbConfig.port} in ${matchedDbConfig.filePath}:${matchedDbConfig.lineNumber}`,
            isConnectionHighlighted: true,
          },
          diagramEvidence: {
            componentName: dbComp.name,
            label: dbComp.name,
          },
          implementationEvidence: {
            summary: `Port mismatch between container definition and code configuration.`,
            references: [
              {
                filePath: matchedDocker.filePath,
                lineNumber: matchedDocker.lineNumber,
                snippet: `Exposed ports: ${matchedDocker.ports?.join(', ')}`,
              },
              {
                filePath: matchedDbConfig.filePath,
                lineNumber: matchedDbConfig.lineNumber,
                snippet: matchedDbConfig.snippet,
              },
            ],
          },
          suggestedVerificationStep: `Align port mappings between the container definition and environment configuration.`,
        });
      }
    }
  }

  // 3. Deterministic Rule Check: Unrepresented Heavy Dependencies in Implementation
  const heavyDependencies = [
    { pkg: '@aws-sdk/client-s3', name: 'AWS S3 / Object Storage', category: 'unexpected_external_dependency' as FindingCategory },
    { pkg: 'stripe', name: 'Stripe Payment Gateway', category: 'implementation_component_not_in_diagram' as FindingCategory },
    { pkg: 'kafkajs', name: 'Apache Kafka Event Broker', category: 'implementation_component_not_in_diagram' as FindingCategory },
    { pkg: 'amqplib', name: 'RabbitMQ Message Broker', category: 'implementation_component_not_in_diagram' as FindingCategory },
    { pkg: 'bullmq', name: 'BullMQ Background Worker', category: 'implementation_component_not_in_diagram' as FindingCategory },
  ];

  for (const h of heavyDependencies) {
    if (evidence.dependencies[h.pkg]) {
      const isRepresentedInDiagram = diagram.components.some((c) =>
        c.name.toLowerCase().includes(h.name.toLowerCase()) ||
        c.name.toLowerCase().includes(h.pkg.split('/').pop() || '')
      );

      if (!isRepresentedInDiagram) {
        const safePkgId = h.pkg.replace(/[^a-zA-Z0-9_-]/g, '_');
        findings.push({
          id: `det-dep-${safePkgId}`,
          title: `Implementation contains ${h.name} not represented in architecture diagram`,
          category: h.category,
          severity: 'warning',
          confidence: 'high',
          userStatus: 'unresolved',
          explanation: `Your code uses "${h.pkg}", but it is not shown in the diagram. Check whether this external service should be added to the design.`,
          connectionTrace: {
            toComponentName: h.name,
            expectedConnection: `Unrepresented in diagram`,
            foundEvidence: `Dependency "${h.pkg}": "${evidence.dependencies[h.pkg]}" in package.json`,
            isConnectionHighlighted: false,
          },
          diagramEvidence: {
            label: 'No corresponding component box in diagram',
            visualNote: `Neither ${h.name} nor ${h.pkg} appear in the visual diagram elements.`,
          },
          implementationEvidence: {
            summary: `Declared dependency "${h.pkg}": "${evidence.dependencies[h.pkg]}" in package.json`,
            references: [
              {
                filePath: 'package.json',
                snippet: `"${h.pkg}": "${evidence.dependencies[h.pkg]}"`,
              },
            ],
          },
          suggestedVerificationStep: `Update the architecture diagram to include ${h.name} as an external service or message queue dependency.`,
        });
      }
    }
  }

  // 4. Deterministic Rule Check: Diagram connections with ambiguous or unverified protocols
  for (const conn of diagram.connections) {
    if (conn.isInconclusive || conn.protocol === 'Unknown') {
      const fromComp = findComp(conn.from)?.name || conn.from;
      const toComp = findComp(conn.to)?.name || conn.to;
      findings.push({
        id: `det-conn-${conn.id}`,
        title: `Unverified or ambiguous connection between "${fromComp}" and "${toComp}"`,
        category: 'unverified_or_mismatched_connection',
        severity: 'inconclusive',
        confidence: 'inconclusive',
        userStatus: 'unresolved',
        explanation: `The diagram depicts a link from "${fromComp}" to "${toComp}", but the protocol is ambiguous or cannot be verified conclusively with the supplied files.`,
        connectionTrace: {
          fromComponentName: fromComp,
          toComponentName: toComp,
          fromComponentId: conn.from,
          toComponentId: conn.to,
          expectedConnection: `Link from "${fromComp}" to "${toComp}" labeled "${conn.label || 'unlabeled'}"`,
          foundEvidence: `No verifiable network call or contract found in supplied files.`,
          isConnectionHighlighted: true,
        },
        diagramEvidence: {
          relationship: `${fromComp} -> ${toComp}`,
          label: conn.label || 'No protocol label on arrow',
        },
        implementationEvidence: {
          summary: `Unable to trace network call or contract in the supplied files.`,
          references: [],
        },
        suggestedVerificationStep: `Verify whether the communication uses REST, gRPC, or an event bus, and document the protocol in the diagram.`,
      });
    }
  }

  // 5. Gemma 4 Multimodal Architecture Reasoning
  try {
    const gemmaFindings = await compareArchitectureWithGemma4(
      diagram,
      evidence,
      Array.from(fileSet)
    );

    // Merge without duplicate titles/categories
    for (const gf of gemmaFindings) {
      const isDuplicate = findings.some(
        (f) =>
          f.title.toLowerCase() === gf.title.toLowerCase() ||
          (f.category === gf.category &&
            f.diagramEvidence.componentName &&
            f.diagramEvidence.componentName === gf.diagramEvidence.componentName)
      );

      if (!isDuplicate) {
        // Ensure userStatus and connectionTrace exist
        gf.userStatus = gf.userStatus || 'unresolved';
        if (!gf.connectionTrace && (gf.diagramEvidence.componentName || gf.diagramEvidence.relationship)) {
          gf.connectionTrace = {
            fromComponentName: gf.diagramEvidence.relationship?.split('->')[0]?.trim(),
            toComponentName: gf.diagramEvidence.componentName || gf.diagramEvidence.relationship?.split('->')[1]?.trim(),
            expectedConnection: gf.diagramEvidence.label || gf.diagramEvidence.visualNote || 'Diagram specification',
            foundEvidence: gf.implementationEvidence.summary,
            isConnectionHighlighted: true,
          };
        }
        findings.push(gf);
      }
    }
  } catch (err) {
    console.warn('Gemma 4 comparative reasoning failed, relying on deterministic findings:', err);
  }

  // 6. Visual ambiguities fallback
  if (diagram.ambiguities.length > 0 && findings.filter((f) => f.category === 'ambiguous_or_inconclusive').length === 0) {
    diagram.ambiguities.forEach((amb, i) => {
      findings.push({
        id: `det-amb-${i + 1}`,
        title: `Visual diagram ambiguity: ${amb.slice(0, 60)}`,
        category: 'ambiguous_or_inconclusive',
        severity: 'inconclusive',
        confidence: 'inconclusive',
        userStatus: 'unresolved',
        explanation: amb,
        diagramEvidence: {
          visualNote: amb,
        },
        implementationEvidence: {
          summary: 'Inconclusive visual evidence prevents definitive code matching.',
          references: [],
        },
        suggestedVerificationStep: 'Review the original diagram source to clarify indistinct labels or connections.',
      });
    });
  }

  return findings;
}
