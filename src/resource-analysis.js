import { getStaticMemberParts, unwrapAwait } from './ast-utils.js';
import { diagnostic } from './diagnostics.js';

export function analyzeResourceLifecycles(program, context, diagnostics) {
  for (const statement of program.body) {
    analyzeFunctionLikeStatement(statement, context, diagnostics);
  }
  visitFunctionExpressions(program, (node) => analyzeFunctionLike(node, context, diagnostics));
}

function analyzeFunctionLikeStatement(statement, context, diagnostics) {
  if (statement.type === 'FunctionDeclaration') {
    analyzeFunctionLike(statement, context, diagnostics);
  }
  if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'FunctionDeclaration') {
    analyzeFunctionLike(statement.declaration, context, diagnostics);
  }
}

function analyzeFunctionLike(node, context, diagnostics) {
  if (node.body?.type !== 'BlockStatement') {
    return;
  }
  const state = {
    context,
    diagnostics,
    resources: new Map(),
    conditionalDepth: 0,
  };
  walkStatements(node.body.body, state);
  finalizeResources(state);
}

function walkStatements(statements, state) {
  for (const statement of statements) {
    walkStatement(statement, state);
  }
}

function walkStatement(statement, state) {
  switch (statement.type) {
    case 'VariableDeclaration':
      for (const declaration of statement.declarations) {
        inspectVariableDeclaration(declaration, state);
      }
      break;
    case 'ExpressionStatement':
      walkExpression(statement.expression, state);
      break;
    case 'ReturnStatement':
      inspectReturn(statement, state);
      if (statement.argument) {
        walkExpression(statement.argument, state);
      }
      break;
    case 'IfStatement':
      walkExpression(statement.test, state);
      state.conditionalDepth += 1;
      walkStatementAsBody(statement.consequent, state);
      if (statement.alternate) {
        walkStatementAsBody(statement.alternate, state);
      }
      state.conditionalDepth -= 1;
      break;
    case 'BlockStatement':
      walkStatements(statement.body, state);
      break;
    case 'TryStatement':
      walkStatement(statement.block, state);
      if (statement.handler?.body) {
        state.conditionalDepth += 1;
        walkStatement(statement.handler.body, state);
        state.conditionalDepth -= 1;
      }
      if (statement.finalizer) {
        walkStatement(statement.finalizer, state);
      }
      break;
    case 'ForStatement':
      if (statement.init?.type === 'VariableDeclaration') {
        walkStatement(statement.init, state);
      } else if (statement.init) {
        walkExpression(statement.init, state);
      }
      if (statement.test) walkExpression(statement.test, state);
      if (statement.update) walkExpression(statement.update, state);
      state.conditionalDepth += 1;
      walkStatementAsBody(statement.body, state);
      state.conditionalDepth -= 1;
      break;
    case 'WhileStatement':
      walkExpression(statement.test, state);
      state.conditionalDepth += 1;
      walkStatementAsBody(statement.body, state);
      state.conditionalDepth -= 1;
      break;
    default:
      break;
  }
}

function walkStatementAsBody(statement, state) {
  if (statement.type === 'BlockStatement') {
    walkStatements(statement.body, state);
    return;
  }
  walkStatement(statement, state);
}

function inspectVariableDeclaration(declaration, state) {
  if (declaration.id.type !== 'Identifier') {
    return;
  }
  const init = unwrapAwait(declaration.init);
  if (!init || init.type !== 'CallExpression') {
    return;
  }
  const resource = classifyResourceOpen(init, state.context);
  if (!resource) {
    walkExpression(init, state);
    return;
  }

  if (resource.kind === 'bus') {
    for (const existing of state.resources.values()) {
      if (existing.kind === 'bus' && !existing.closed && !existing.transferred && existing.resourceName === resource.resourceName) {
        state.diagnostics.push(diagnostic({
          code: 'SATJS_RESOURCE_INTERLEAVING',
          message: `bus '${resource.resourceName}' is opened again before handle '${existing.variableName}' is closed or transferred.`,
          node: init,
          hint: 'Close the previous bus handle before opening the same bus again in the same task body.',
        }));
      }
    }
  }

  state.resources.set(declaration.id.name, {
    variableName: declaration.id.name,
    kind: resource.kind,
    resourceName: resource.resourceName,
    acquiredNode: init,
    closed: false,
    releasedConditionally: false,
    transferred: false,
  });
}

function classifyResourceOpen(call, context) {
  const parts = getStaticMemberParts(call.callee);
  if (!parts || parts.length !== 2) {
    return undefined;
  }
  const namespaceName = resolveSatelliteImport(parts[0], context);
  if (namespaceName === 'bus' && parts[1] === 'open') {
    return { kind: 'bus', resourceName: literalName(call.arguments[0]) ?? '<dynamic-bus>' };
  }
  if (namespaceName === 'device' && parts[1] === 'acquire') {
    return { kind: 'device', resourceName: literalName(call.arguments[0]) ?? '<dynamic-device>' };
  }
  return undefined;
}

function walkExpression(expression, state) {
  if (!expression) {
    return;
  }
  if (expression.type === 'AwaitExpression') {
    walkExpression(expression.argument, state);
    return;
  }
  if (expression.type === 'CallExpression') {
    inspectCall(expression, state);
  }
  for (const value of Object.values(expression)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child?.type) walkExpression(child, state);
      }
      continue;
    }
    if (value.type && !['FunctionExpression', 'ArrowFunctionExpression'].includes(value.type)) {
      walkExpression(value, state);
    }
  }
}

function inspectCall(call, state) {
  const parts = getStaticMemberParts(call.callee);
  if (parts?.length === 2 && parts[1] === 'close') {
    markClosed(parts[0], state);
    return;
  }

  if (parts?.length === 2) {
    const namespaceName = resolveSatelliteImport(parts[0], state.context);
    if (namespaceName === 'device' && parts[1] === 'release') {
      markDeviceReleased(literalName(call.arguments[0]), state);
      return;
    }
  }

  if (isTransferCall(call)) {
    for (const arg of call.arguments) {
      if (arg.type === 'Identifier' && state.resources.has(arg.name)) {
        state.resources.get(arg.name).transferred = true;
      }
    }
  }
}

function inspectReturn(statement, state) {
  if (statement.argument?.type === 'Identifier' && state.resources.has(statement.argument.name)) {
    state.resources.get(statement.argument.name).transferred = true;
  }
}

function markClosed(variableName, state) {
  const resource = state.resources.get(variableName);
  if (!resource) {
    return;
  }
  if (state.conditionalDepth > 0) {
    resource.releasedConditionally = true;
    return;
  }
  resource.closed = true;
}

function markDeviceReleased(resourceName, state) {
  for (const resource of state.resources.values()) {
    if (resource.kind !== 'device') {
      continue;
    }
    if (resource.resourceName !== resourceName && resource.resourceName !== '<dynamic-device>') {
      continue;
    }
    if (state.conditionalDepth > 0) {
      resource.releasedConditionally = true;
      continue;
    }
    resource.closed = true;
  }
}

function finalizeResources(state) {
  for (const resource of state.resources.values()) {
    if (resource.closed || resource.transferred) {
      continue;
    }
    if (resource.releasedConditionally) {
      state.diagnostics.push(diagnostic({
        code: 'SATJS_RESOURCE_LIFECYCLE',
        message: `${resource.kind} resource '${resource.variableName}' is released only on a conditional path.`,
        node: resource.acquiredNode,
        hint: 'Move close/release to an unconditional cleanup path or return/transfer the handle deliberately.',
      }));
      continue;
    }
    state.diagnostics.push(diagnostic({
      code: 'SATJS_RESOURCE_LIFECYCLE',
      message: `${resource.kind} resource '${resource.variableName}' is acquired but not closed, released, returned, or transferred.`,
      node: resource.acquiredNode,
      hint: resource.kind === 'bus'
        ? 'Call handle.close() before the task exits, or return/pass it to transferResource(handle).'
        : 'Call device.release(name) before the task exits, or return/pass the handle to transferResource(handle).',
    }));
  }
}

function visitFunctionExpressions(node, callback) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    callback(node);
    return;
  }
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        visitFunctionExpressions(child, callback);
      }
      continue;
    }
    visitFunctionExpressions(value, callback);
  }
}

function isTransferCall(call) {
  const parts = getStaticMemberParts(call.callee);
  if (!parts) {
    return false;
  }
  const name = parts.join('.');
  return name === 'transferResource' || name.endsWith('.transferResource');
}

function literalName(node) {
  return node?.type === 'StringLiteral' ? node.value : undefined;
}

function resolveSatelliteImport(localName, context) {
  return context.satelliteImports.get(localName) ?? localName;
}
