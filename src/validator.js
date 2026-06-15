import { TranspileError, diagnostic } from './diagnostics.js';
import { SATELLITE_MODULE, SATELLITE_NAMESPACES, isSatelliteNamespace } from './satellite-api.js';

const VISITOR_SKIP_KEYS = new Set([
  'type',
  'loc',
  'range',
  'start',
  'end',
  'extra',
  'leadingComments',
  'innerComments',
  'trailingComments',
]);

export function validateMissionProgram(ast, filename = '<input>') {
  const diagnostics = [];

  if (ast.type !== 'File' || ast.program?.type !== 'Program') {
    diagnostics.push(diagnostic({
      code: 'SATJS_INVALID_AST',
      message: 'Expected a Babel File AST with a Program body.',
      node: ast,
    }));
    throwIfDiagnostics(diagnostics, filename);
  }

  const context = collectImportContext(ast.program.body, diagnostics);
  validateTopLevelPolicy(ast.program.body, context, diagnostics);
  visitNode(ast.program, (node) => validateForbiddenNode(node, diagnostics));

  throwIfDiagnostics(diagnostics, filename);
  return { diagnostics: [] };
}

function throwIfDiagnostics(diagnostics, filename) {
  if (diagnostics.length > 0) {
    throw new TranspileError(`Validation failed for ${filename}`, diagnostics);
  }
}

function collectImportContext(statements, diagnostics) {
  const context = {
    satelliteImports: new Map(),
    relativeImports: new Set(),
    functionDeclarations: new Set(),
  };

  for (const statement of statements) {
    if (statement.type === 'FunctionDeclaration' && statement.id?.name) {
      context.functionDeclarations.add(statement.id.name);
      continue;
    }

    if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'FunctionDeclaration' && statement.declaration.id?.name) {
      context.functionDeclarations.add(statement.declaration.id.name);
      continue;
    }

    if (statement.type !== 'ImportDeclaration') {
      continue;
    }

    const source = statement.source.value;
    if (source === SATELLITE_MODULE) {
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ImportSpecifier') {
          diagnostics.push(diagnostic({
            code: 'SATJS_SATELLITE_IMPORT',
            message: 'Only named imports are allowed from satellite-os.',
            node: specifier,
            hint: "Use import { bus, device, task, telemetry, fault } from 'satellite-os'.",
          }));
          continue;
        }
        const importedName = specifier.imported.name;
        if (!SATELLITE_NAMESPACES.has(importedName)) {
          diagnostics.push(diagnostic({
            code: 'SATJS_SATELLITE_IMPORT',
            message: `Unknown satellite-os import '${importedName}'.`,
            node: specifier,
            hint: `Allowed imports are: ${[...SATELLITE_NAMESPACES].join(', ')}.`,
          }));
          continue;
        }
        context.satelliteImports.set(specifier.local.name, importedName);
      }
      continue;
    }

    if (source.startsWith('.')) {
      for (const specifier of statement.specifiers) {
        if (specifier.local?.name) {
          context.relativeImports.add(specifier.local.name);
        }
      }
      continue;
    }

    diagnostics.push(diagnostic({
      code: 'SATJS_IMPORT_UNSUPPORTED',
      message: `Unsupported import source '${source}'.`,
      node: statement,
      hint: 'Mission scripts may import satellite-os and relative driver/helper modules only.',
    }));
  }

  return context;
}

function validateTopLevelPolicy(statements, context, diagnostics) {
  for (const statement of statements) {
    if (isAllowedTopLevelStatement(statement, context, diagnostics)) {
      continue;
    }

    diagnostics.push(diagnostic({
      code: 'SATJS_TOP_LEVEL_POLICY',
      message: `Unsupported top-level ${statement.type}.`,
      node: statement,
      hint: 'Top-level code should be imports, named functions, const declarations, device.register, fault.handle, task.once/every/on, or task.start.',
    }));
  }
}

function isAllowedTopLevelStatement(statement, context, diagnostics) {
  switch (statement.type) {
    case 'ImportDeclaration':
    case 'FunctionDeclaration':
    case 'EmptyStatement':
      return true;
    case 'ExportNamedDeclaration':
      return !statement.declaration || isAllowedTopLevelStatement(statement.declaration, context, diagnostics);
    case 'VariableDeclaration':
      return statement.kind === 'const';
    case 'ExpressionStatement':
      return validateTopLevelExpression(statement.expression, context, diagnostics);
    default:
      return false;
  }
}

function validateTopLevelExpression(expression, context, diagnostics) {
  if (expression.type !== 'CallExpression') {
    return false;
  }

  const parts = getStaticMemberParts(expression.callee);
  if (!parts || parts.length < 2) {
    return false;
  }

  const namespaceName = resolveSatelliteImport(parts[0], context);
  if (!isSatelliteNamespace(namespaceName)) {
    return false;
  }

  const method = parts.slice(1).join('.');
  if (namespaceName === 'device' && method === 'register') {
    validateArity(expression, 3, 'device.register', diagnostics);
    validateDeviceRegister(expression, context, diagnostics);
    return true;
  }

  if (namespaceName === 'fault' && method === 'handle') {
    validateArity(expression, 2, 'fault.handle', diagnostics);
    validateCallbackShape(expression.arguments[1], 'fault.handle', diagnostics);
    return true;
  }

  if (namespaceName === 'task' && ['once', 'on'].includes(method)) {
    validateArity(expression, 2, `task.${method}`, diagnostics);
    validateCallbackShape(expression.arguments[1], `task.${method}`, diagnostics);
    return true;
  }

  if (namespaceName === 'task' && method === 'every') {
    validateArity(expression, 3, 'task.every', diagnostics);
    validateCallbackShape(expression.arguments[2], 'task.every', diagnostics);
    return true;
  }

  if (namespaceName === 'task' && method === 'start') {
    validateArity(expression, 0, 'task.start', diagnostics);
    return true;
  }

  return false;
}

function validateArity(call, expected, apiName, diagnostics) {
  if (call.arguments.length !== expected) {
    diagnostics.push(diagnostic({
      code: 'SATJS_API_ARITY',
      message: `${apiName} expects ${expected} argument${expected === 1 ? '' : 's'}, got ${call.arguments.length}.`,
      node: call,
    }));
  }
}

function validateDeviceRegister(call, context, diagnostics) {
  const driverArg = call.arguments[1];
  if (!driverArg) {
    return;
  }
  if (driverArg.type !== 'Identifier') {
    diagnostics.push(diagnostic({
      code: 'SATJS_DRIVER_IMPORT',
      message: 'device.register driver argument must be an imported driver identifier.',
      node: driverArg,
      hint: "Import the driver from a relative module, e.g. import { EPSDriver } from './drivers/eps.js'.",
    }));
    return;
  }
  if (!context.relativeImports.has(driverArg.name)) {
    diagnostics.push(diagnostic({
      code: 'SATJS_DRIVER_IMPORT',
      message: `device.register driver '${driverArg.name}' is not imported from a relative driver/helper module.`,
      node: driverArg,
      hint: 'The second argument becomes a C++ template type and must resolve to a local header include.',
    }));
  }
}

function validateCallbackShape(callbackArg, apiName, diagnostics) {
  if (!callbackArg) {
    return;
  }
  if (['Identifier', 'ArrowFunctionExpression', 'FunctionExpression'].includes(callbackArg.type)) {
    return;
  }
  diagnostics.push(diagnostic({
    code: 'SATJS_CALLBACK_SHAPE',
    message: `${apiName} callback must be a named function, function expression, or arrow function.`,
    node: callbackArg,
    hint: 'Use named callbacks for traceability when possible.',
  }));
}

function validateForbiddenNode(node, diagnostics) {
  if (node.type === 'CallExpression') {
    validateForbiddenCall(node, diagnostics);
  }
  if (node.type === 'NewExpression') {
    validateForbiddenNew(node, diagnostics);
  }
}

function validateForbiddenCall(node, diagnostics) {
  if (node.callee.type === 'Import') {
    diagnostics.push(diagnostic({
      code: 'SATJS_FORBIDDEN_API',
      message: 'Dynamic import() is not supported in mission scripts.',
      node,
      hint: 'Use static relative imports so generated C++ includes are deterministic.',
    }));
    return;
  }

  const parts = getStaticMemberParts(node.callee);
  const root = parts?.[0];
  const method = parts?.join('.');

  if (root === 'console') {
    diagnostics.push(diagnostic({
      code: 'SATJS_FORBIDDEN_API',
      message: `console.* is not supported (${method}).`,
      node,
      hint: 'Use telemetry.emit for structured downlinkable observability.',
    }));
    return;
  }

  if (['setTimeout', 'setInterval'].includes(root) || ['globalThis.setTimeout', 'globalThis.setInterval'].includes(method)) {
    diagnostics.push(diagnostic({
      code: 'SATJS_FORBIDDEN_API',
      message: `${method ?? root} is not supported in mission scripts.`,
      node,
      hint: 'Use task.once, task.every, task.on, or scheduler/runtime APIs instead.',
    }));
    return;
  }

  if (root === 'eval') {
    diagnostics.push(diagnostic({
      code: 'SATJS_FORBIDDEN_API',
      message: 'eval is not supported in mission scripts.',
      node,
      hint: 'Mission code must be statically analyzable before C++ generation.',
    }));
    return;
  }

  if (root === 'Reflect') {
    diagnostics.push(diagnostic({
      code: 'SATJS_FORBIDDEN_API',
      message: `Reflect APIs are not supported (${method}).`,
      node,
      hint: 'Avoid reflection so generated C++ remains deterministic and auditable.',
    }));
  }
}

function validateForbiddenNew(node, diagnostics) {
  const parts = getStaticMemberParts(node.callee);
  const root = parts?.[0];
  if (root === 'Function' || root === 'Proxy') {
    diagnostics.push(diagnostic({
      code: 'SATJS_FORBIDDEN_API',
      message: `new ${root}(...) is not supported in mission scripts.`,
      node,
      hint: 'Mission code must avoid dynamic code generation and proxy traps.',
    }));
  }
}

function visitNode(node, callback) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (typeof node.type === 'string') {
    callback(node);
  }
  for (const [key, value] of Object.entries(node)) {
    if (VISITOR_SKIP_KEYS.has(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        visitNode(child, callback);
      }
      continue;
    }
    visitNode(value, callback);
  }
}

function getStaticMemberParts(node) {
  if (!node) {
    return undefined;
  }
  if (node.type === 'Identifier') {
    return [node.name];
  }
  if (node.type !== 'MemberExpression' || node.computed) {
    return undefined;
  }
  const objectParts = getStaticMemberParts(node.object);
  if (!objectParts || node.property.type !== 'Identifier') {
    return undefined;
  }
  return [...objectParts, node.property.name];
}

function resolveSatelliteImport(localName, context) {
  return context.satelliteImports.get(localName) ?? localName;
}
