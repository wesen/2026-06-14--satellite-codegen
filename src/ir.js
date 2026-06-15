import { getStaticMemberParts } from './ast-utils.js';
import { SATELLITE_MODULE, isSatelliteNamespace, modulePathToHeader } from './satellite-api.js';

export function buildMissionIR(ast, { runtimeHeader = 'satellite_os.hpp' } = {}) {
  if (ast.type !== 'File' || ast.program?.type !== 'Program') {
    throw new Error('buildMissionIR expects a Babel File AST with a Program body');
  }

  const satelliteImports = [];
  const localImports = [];
  const localIncludes = [];
  const functions = [];
  const constants = [];
  const boot = [];
  const importMap = new Map();

  for (const statement of ast.program.body) {
    if (statement.type === 'ImportDeclaration') {
      const source = statement.source.value;
      if (source === SATELLITE_MODULE) {
        for (const specifier of statement.specifiers) {
          const imported = specifier.imported.name;
          const local = specifier.local.name;
          satelliteImports.push({ local, imported });
          importMap.set(local, imported);
        }
        continue;
      }

      if (source.startsWith('.')) {
        const header = modulePathToHeader(source);
        localIncludes.push(header);
        localImports.push({
          source,
          header,
          specifiers: statement.specifiers
            .filter((specifier) => specifier.local?.name)
            .map((specifier) => ({
              local: specifier.local.name,
              imported: specifier.imported?.name ?? specifier.local.name,
            })),
        });
      }
      continue;
    }

    if (statement.type === 'FunctionDeclaration') {
      functions.push({ kind: 'MissionFunction', name: statement.id.name, node: statement });
      continue;
    }

    if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'FunctionDeclaration') {
      functions.push({ kind: 'MissionFunction', name: statement.declaration.id.name, node: statement.declaration, exported: true });
      continue;
    }

    if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
      constants.push({ kind: 'ConstDeclaration', node: statement });
      continue;
    }

    if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'VariableDeclaration') {
      constants.push({ kind: 'ConstDeclaration', node: statement.declaration, exported: true });
      continue;
    }

    if (statement.type === 'ExpressionStatement') {
      const operation = lowerBootExpression(statement.expression, importMap);
      if (operation) {
        boot.push({ ...operation, node: statement.expression, statement });
        continue;
      }
    }

    if (statement.type === 'EmptyStatement') {
      continue;
    }

    boot.push({ kind: 'RawStatement', node: statement, statement });
  }

  return {
    kind: 'MissionProgram',
    runtimeHeader,
    sourceType: ast.program.sourceType,
    satelliteImports,
    localImports,
    localIncludes: [...new Set(localIncludes)],
    functions,
    constants,
    boot,
  };
}

function lowerBootExpression(expression, importMap) {
  if (expression.type !== 'CallExpression') {
    return undefined;
  }

  const parts = getStaticMemberParts(expression.callee);
  if (!parts || parts.length < 2) {
    return undefined;
  }

  const namespaceName = importMap.get(parts[0]) ?? parts[0];
  if (!isSatelliteNamespace(namespaceName)) {
    return undefined;
  }

  const method = parts.slice(1).join('.');
  if (namespaceName === 'device' && method === 'register') {
    return {
      kind: 'RegisterDevice',
      name: expression.arguments[0],
      driverType: expression.arguments[1]?.name,
      driverNode: expression.arguments[1],
      options: expression.arguments[2],
    };
  }

  if (namespaceName === 'fault' && method === 'handle') {
    return {
      kind: 'RegisterFaultHandler',
      faultName: expression.arguments[0],
      callback: lowerCallback(expression.arguments[1]),
    };
  }

  if (namespaceName === 'task' && ['once', 'on'].includes(method)) {
    return {
      kind: 'RegisterTask',
      mode: method,
      name: expression.arguments[0],
      callback: lowerCallback(expression.arguments[1]),
    };
  }

  if (namespaceName === 'task' && method === 'every') {
    return {
      kind: 'RegisterTask',
      mode: 'every',
      name: expression.arguments[0],
      period: expression.arguments[1],
      callback: lowerCallback(expression.arguments[2]),
    };
  }

  if (namespaceName === 'task' && method === 'start') {
    return { kind: 'StartScheduler' };
  }

  return undefined;
}

function lowerCallback(node) {
  if (!node) {
    return { kind: 'MissingCallback' };
  }
  if (node.type === 'Identifier') {
    return { kind: 'CallbackRef', name: node.name, node };
  }
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return { kind: 'InlineCallback', node };
  }
  return { kind: 'UnsupportedCallback', node };
}

export function missionIRToJSON(ir) {
  return JSON.stringify(stripAstNodes(ir), null, 2);
}

function stripAstNodes(value) {
  if (Array.isArray(value)) {
    return value.map(stripAstNodes);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (typeof value.type === 'string') {
    return summarizeAstNode(value);
  }
  const result = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'statement' || key === 'node' || key === 'driverNode') {
      result[key] = summarizeAstNode(nested);
      continue;
    }
    result[key] = stripAstNodes(nested);
  }
  return result;
}

function summarizeAstNode(node) {
  if (!node) {
    return null;
  }
  const summary = {
    type: node.type,
  };
  if (node.loc?.start) {
    summary.loc = {
      line: node.loc.start.line,
      column: node.loc.start.column + 1,
    };
  }
  if (node.type === 'Identifier') {
    summary.name = node.name;
  }
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral' || node.type === 'BooleanLiteral') {
    summary.value = node.value;
  }
  if (node.type === 'CallExpression') {
    summary.callee = getStaticMemberParts(node.callee)?.join('.') ?? node.callee.type;
  }
  return summary;
}
