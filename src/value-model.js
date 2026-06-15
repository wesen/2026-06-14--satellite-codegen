import { getStaticMemberParts } from './ast-utils.js';

export const VALUE_KINDS = Object.freeze({
  NULL: 'null',
  BOOLEAN: 'boolean',
  INTEGER: 'integer',
  FLOAT: 'float',
  STRING: 'string',
  BYTES: 'bytes',
  ARRAY: 'array',
  OBJECT: 'object',
  IDENTIFIER: 'identifier',
  UNKNOWN_CALL: 'unknown-call',
});

export function normalizeNumericLiteralRaw(node) {
  return (node.extra?.raw ?? String(node.value)).replaceAll('_', '');
}

export function classifyValueExpression(node) {
  if (!node) {
    return { ok: false, reason: 'missing value expression', node };
  }

  switch (node.type) {
    case 'NullLiteral':
      return { ok: true, kind: VALUE_KINDS.NULL, node };
    case 'BooleanLiteral':
      return { ok: true, kind: VALUE_KINDS.BOOLEAN, value: node.value, node };
    case 'StringLiteral':
      return { ok: true, kind: VALUE_KINDS.STRING, value: node.value, node };
    case 'NumericLiteral':
      return classifyNumber(node);
    case 'Identifier':
      return { ok: true, kind: VALUE_KINDS.IDENTIFIER, name: node.name, node };
    case 'ArrayExpression':
      return classifyArray(node);
    case 'ObjectExpression':
      return classifyObject(node);
    case 'CallExpression':
      if (isUint8ArrayOfCall(node)) {
        return classifyBytes(node);
      }
      return { ok: true, kind: VALUE_KINDS.UNKNOWN_CALL, node };
    default:
      return { ok: false, reason: `unsupported value expression ${node.type}`, node };
  }
}

export function isUint8ArrayOfCall(node) {
  const parts = getStaticMemberParts(node?.callee);
  return Boolean(parts && parts.length === 2 && parts[0] === 'Uint8Array' && parts[1] === 'of');
}

export function isSafeIntegerLiteral(node) {
  return node?.type === 'NumericLiteral' && Number.isInteger(node.value) && Number.isSafeInteger(node.value);
}

export function isByteLiteral(node) {
  return isSafeIntegerLiteral(node) && node.value >= 0 && node.value <= 255;
}

function classifyNumber(node) {
  const raw = normalizeNumericLiteralRaw(node);
  if (!Number.isFinite(node.value)) {
    return { ok: false, reason: 'numeric literal must be finite', node };
  }
  if (Number.isInteger(node.value)) {
    if (!Number.isSafeInteger(node.value)) {
      return { ok: false, reason: 'integer literal is outside JavaScript safe integer range', node };
    }
    return { ok: true, kind: VALUE_KINDS.INTEGER, value: node.value, raw, node };
  }
  return { ok: true, kind: VALUE_KINDS.FLOAT, value: node.value, raw, node };
}

function classifyArray(node) {
  const elements = [];
  for (const element of node.elements) {
    if (!element) {
      return { ok: false, reason: 'sparse arrays are not supported', node };
    }
    if (element.type === 'SpreadElement') {
      return { ok: false, reason: 'array spread is not supported in mission values', node: element };
    }
    const classified = classifyValueExpression(element);
    if (!classified.ok) {
      return classified;
    }
    elements.push(classified);
  }
  return { ok: true, kind: VALUE_KINDS.ARRAY, elements, node };
}

function classifyObject(node) {
  const properties = [];
  for (const property of node.properties) {
    if (property.type !== 'ObjectProperty') {
      return { ok: false, reason: 'object spread and methods are not supported in mission values', node: property };
    }
    if (property.computed) {
      return { ok: false, reason: 'computed object keys are not supported in mission values', node: property };
    }
    const classified = classifyValueExpression(property.value);
    if (!classified.ok) {
      return classified;
    }
    properties.push({ key: property.key, value: classified });
  }
  return { ok: true, kind: VALUE_KINDS.OBJECT, properties, node };
}

function classifyBytes(node) {
  for (const arg of node.arguments) {
    if (!isByteLiteral(arg)) {
      return { ok: false, reason: 'Uint8Array.of arguments must be integer byte literals in the range 0..255', node: arg };
    }
  }
  return {
    ok: true,
    kind: VALUE_KINDS.BYTES,
    bytes: node.arguments.map((arg) => ({ value: arg.value, raw: normalizeNumericLiteralRaw(arg) })),
    node,
  };
}
