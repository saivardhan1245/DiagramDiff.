import type {
  ProjectEvidence,
  ExtractedRoute,
  ExtractedServiceCall,
  ExtractedDbConfig,
  ExtractedDockerService,
} from '../../types/index.js';

export interface UploadedFileItem {
  path: string;
  content: string;
}

/**
 * Deterministically parses uploaded project files to gather verifiable evidence.
 * Does not execute any code.
 */
export function extractProjectEvidence(files: UploadedFileItem[]): ProjectEvidence {
  const fileInventory: string[] = files.map((f) => f.path);
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  const routes: ExtractedRoute[] = [];
  const outboundCalls: ExtractedServiceCall[] = [];
  const databases: ExtractedDbConfig[] = [];
  const dockerServices: ExtractedDockerService[] = [];
  const entryPoints: Array<{ path: string; line: number }> = [];
  const rawFilesSnippet: Record<string, string> = {};

  for (const file of files) {
    const lines = file.content.split('\n');
    // Store content for evidence preview (truncated to reasonable size if huge)
    rawFilesSnippet[file.path] = file.content.slice(0, 50000);

    const lowerPath = file.path.toLowerCase();

    // 1. Entry point detection
    if (
      lowerPath.endsWith('server.ts') ||
      lowerPath.endsWith('server.js') ||
      lowerPath.endsWith('index.ts') ||
      lowerPath.endsWith('index.js') ||
      lowerPath.endsWith('main.ts') ||
      lowerPath.endsWith('main.py') ||
      lowerPath.endsWith('app.ts') ||
      lowerPath.endsWith('app.js')
    ) {
      entryPoints.push({ path: file.path, line: 1 });
    }

    // 2. package.json parser
    if (lowerPath.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(file.content);
        if (pkg.dependencies && typeof pkg.dependencies === 'object') {
          dependencies = { ...dependencies, ...pkg.dependencies };
        }
        if (pkg.devDependencies && typeof pkg.devDependencies === 'object') {
          devDependencies = { ...devDependencies, ...pkg.devDependencies };
        }
      } catch {
        // ignore parse error on malformed package.json
      }
    }

    // 3. docker-compose parser (YAML simple extraction)
    if (lowerPath.includes('docker-compose') || lowerPath.endsWith('compose.yaml') || lowerPath.endsWith('compose.yml')) {
      extractDockerComposeServices(file.path, lines, dockerServices);
    }

    // 4. Dockerfile port & base image
    if (lowerPath.endsWith('dockerfile') || lowerPath.includes('dockerfile.')) {
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('EXPOSE ')) {
          const port = trimmed.replace('EXPOSE ', '').trim();
          dockerServices.push({
            name: 'dockerfile-container',
            ports: [port],
            filePath: file.path,
            lineNumber: idx + 1,
          });
        }
      });
    }

    // 5. Line-by-line inspection for routes, database calls, outbound HTTP
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Route definitions
      // e.g. app.get('/api/users', ...), router.post("/auth/login", ...)
      const routeMatch = line.match(/(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (routeMatch) {
        routes.push({
          method: routeMatch[1].toUpperCase(),
          path: routeMatch[2],
          filePath: file.path,
          lineNumber: lineNum,
          handlerSnippet: line.slice(0, 160).trim(),
        });
      }

      // Fastify / Koa / Flask / Express route patterns
      const flaskRouteMatch = line.match(/@(?:app|bp|api)\.route\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (flaskRouteMatch) {
        routes.push({
          method: 'ROUTE',
          path: flaskRouteMatch[1],
          filePath: file.path,
          lineNumber: lineNum,
          handlerSnippet: line.slice(0, 160).trim(),
        });
      }

      // Outbound calls: fetch, axios, got, http.get
      const fetchMatch = line.match(/(?:fetch|axios\.(?:get|post|put|delete|patch)|http\.get|https\.get)\s*\(\s*['"`](https?:\/\/[^'"`]+|\/[^'"`]+)['"`]/i);
      if (fetchMatch) {
        outboundCalls.push({
          target: fetchMatch[1],
          filePath: file.path,
          lineNumber: lineNum,
          snippet: line.slice(0, 160).trim(),
        });
      }

      // Axios baseURL or client config
      const axiosBaseUrlMatch = line.match(/baseURL\s*:\s*['"`]([^'"`]+)['"`]/i);
      if (axiosBaseUrlMatch) {
        outboundCalls.push({
          target: axiosBaseUrlMatch[1],
          endpoint: 'baseURL',
          filePath: file.path,
          lineNumber: lineNum,
          snippet: line.slice(0, 160).trim(),
        });
      }

      // Database connections & clients
      // PostgreSQL / MySQL / MongoDB / Redis / Prisma / TypeORM
      if (
        /new\s+(?:Pool|Client|PrismaClient|Sequelize|DataSource)\s*\(|mongoose\.connect|createClient\(|new\s+Redis\s*\(|mysql\.createConnection/i.test(line)
      ) {
        let type = 'Database';
        if (/postgres|pg|Pool/i.test(line)) type = 'PostgreSQL';
        else if (/mysql/i.test(line)) type = 'MySQL';
        else if (/mongo/i.test(line)) type = 'MongoDB';
        else if (/redis/i.test(line)) type = 'Redis';
        else if (/prisma/i.test(line)) type = 'Prisma (Relational/Document)';
        else if (/sqlite/i.test(line)) type = 'SQLite';

        // Check for host or port
        const portMatch = line.match(/port\s*:\s*(\d+)/i);
        const hostMatch = line.match(/host\s*:\s*['"`]([^'"`]+)['"`]/i);

        databases.push({
          type,
          hostOrUrl: hostMatch ? hostMatch[1] : undefined,
          port: portMatch ? portMatch[1] : undefined,
          filePath: file.path,
          lineNumber: lineNum,
          snippet: line.slice(0, 160).trim(),
        });
      }

      // Database connection strings in code
      const connStrMatch = line.match(/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s'"`]+/i);
      if (connStrMatch) {
        let dbType = 'Database URL';
        if (connStrMatch[0].startsWith('postgres')) dbType = 'PostgreSQL';
        if (connStrMatch[0].startsWith('mysql')) dbType = 'MySQL';
        if (connStrMatch[0].startsWith('mongo')) dbType = 'MongoDB';
        if (connStrMatch[0].startsWith('redis')) dbType = 'Redis';

        databases.push({
          type: dbType,
          hostOrUrl: connStrMatch[0].split('@').pop() || connStrMatch[0], // sanitize credentials
          filePath: file.path,
          lineNumber: lineNum,
          snippet: line.slice(0, 160).trim(),
        });
      }
    });
  }

  return {
    fileInventory,
    dependencies,
    devDependencies,
    routes,
    outboundCalls,
    databases,
    dockerServices,
    entryPoints,
    rawFilesSnippet,
  };
}

/**
 * Deterministic line-based parser for docker-compose services.
 */
function extractDockerComposeServices(
  filePath: string,
  lines: string[],
  servicesList: ExtractedDockerService[]
) {
  let inServices = false;
  let currentService: {
    name: string;
    image?: string;
    ports?: string[];
    environment?: string[];
    dependsOn?: string[];
  } | null = null;
  let serviceStartLine = 1;
  let inPorts = false;
  let inEnv = false;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    if (trimmed.startsWith('services:')) {
      inServices = true;
      return;
    }

    if (inServices) {
      // 2 spaces indentation usually denotes service name
      const serviceMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):\s*$/);
      if (serviceMatch) {
        if (currentService) {
          servicesList.push({
            name: currentService.name,
            image: currentService.image,
            ports: currentService.ports || [],
            environment: currentService.environment || [],
            dependsOn: currentService.dependsOn || [],
            filePath,
            lineNumber: serviceStartLine,
          });
        }
        currentService = {
          name: serviceMatch[1],
          ports: [],
          environment: [],
          dependsOn: [],
        };
        serviceStartLine = lineNum;
        inPorts = false;
        inEnv = false;
        return;
      }

      if (currentService) {
        if (trimmed.startsWith('image:')) {
          currentService.image = trimmed.replace('image:', '').trim();
        } else if (trimmed.startsWith('ports:')) {
          inPorts = true;
          inEnv = false;
        } else if (trimmed.startsWith('environment:')) {
          inEnv = true;
          inPorts = false;
        } else if (trimmed.startsWith('depends_on:')) {
          inPorts = false;
          inEnv = false;
        } else if (inPorts && trimmed.startsWith('-')) {
          const portVal = trimmed.replace(/^-\s*/, '').replace(/['"]/g, '');
          currentService.ports?.push(portVal);
        } else if (inEnv && trimmed.startsWith('-')) {
          const envVal = trimmed.replace(/^-\s*/, '');
          currentService.environment?.push(envVal.split('=')[0]);
        } else if (line.match(/^ {4}[a-zA-Z0-9_-]+:/)) {
          // another section inside service
          inPorts = false;
          inEnv = false;
        }
      }
    }
  });

  const lastService: any = currentService;
  if (lastService?.name) {
    servicesList.push({
      name: lastService.name,
      image: lastService.image,
      ports: lastService.ports || [],
      environment: lastService.environment || [],
      dependsOn: lastService.dependsOn || [],
      filePath,
      lineNumber: serviceStartLine,
    });
  }
}
