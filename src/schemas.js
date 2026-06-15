import { diagnostic } from './diagnostics.js';
import { classifyValueExpression, VALUE_KINDS } from './value-model.js';

const DRIVER_OPTION_RULES = {
  bus: { kind: VALUE_KINDS.STRING },
  address: { kind: VALUE_KINDS.INTEGER, min: 0, max: 0xffff },
  cs: { kind: VALUE_KINDS.INTEGER, min: 0, max: 255 },
  clockHz: { kind: VALUE_KINDS.INTEGER, min: 1, max: 10_000_000 },
};

export function validateDriverOptions(optionsNode, diagnostics) {
  const classified = classifyValueExpression(optionsNode);
  if (!classified.ok) {
    diagnostics.push(diagnostic({
      code: 'SATJS_VALUE_SHAPE',
      message: classified.reason,
      node: classified.node,
    }));
    return;
  }

  if (classified.kind !== VALUE_KINDS.OBJECT) {
    diagnostics.push(diagnostic({
      code: 'SATJS_DRIVER_OPTIONS',
      message: 'device.register options must be an object literal.',
      node: optionsNode,
    }));
    return;
  }

  for (const property of optionsNode.properties) {
    const key = getObjectKeyName(property.key);
    const rule = DRIVER_OPTION_RULES[key];
    if (!rule) {
      continue;
    }
    const value = classifyValueExpression(property.value);
    if (!value.ok) {
      diagnostics.push(diagnostic({
        code: 'SATJS_VALUE_SHAPE',
        message: value.reason,
        node: value.node,
      }));
      continue;
    }
    if (value.kind !== rule.kind) {
      diagnostics.push(diagnostic({
        code: 'SATJS_DRIVER_OPTIONS',
        message: `driver option '${key}' must be a ${rule.kind}, got ${value.kind}.`,
        node: property.value,
      }));
      continue;
    }
    if (value.kind === VALUE_KINDS.INTEGER && ((rule.min !== undefined && value.value < rule.min) || (rule.max !== undefined && value.value > rule.max))) {
      diagnostics.push(diagnostic({
        code: 'SATJS_DRIVER_OPTIONS',
        message: `driver option '${key}' must be in range ${rule.min}..${rule.max}.`,
        node: property.value,
      }));
    }
  }
}

export function validateTelemetryValue(metricNameNode, valueNode, diagnostics) {
  const classified = classifyValueExpression(valueNode);
  if (!classified.ok) {
    diagnostics.push(diagnostic({
      code: 'SATJS_VALUE_SHAPE',
      message: classified.reason,
      node: classified.node,
    }));
    return;
  }

  if (metricNameNode?.type !== 'StringLiteral') {
    diagnostics.push(diagnostic({
      code: 'SATJS_TELEMETRY_METRIC',
      message: 'telemetry metric names must be string literals.',
      node: metricNameNode,
      hint: 'Use stable dotted names such as thermal.panel_temp_c.',
    }));
  }

  if (classified.kind === VALUE_KINDS.STRING) {
    diagnostics.push(diagnostic({
      code: 'SATJS_TELEMETRY_VALUE',
      message: 'telemetry values must not be strings in mission hot paths.',
      node: valueNode,
      hint: 'Emit numeric, boolean, byte, or array values; encode status strings as enumerated numeric values.',
    }));
    return;
  }

  if (classified.kind === VALUE_KINDS.OBJECT) {
    diagnostics.push(diagnostic({
      code: 'SATJS_TELEMETRY_VALUE',
      message: 'telemetry values must not be arbitrary objects.',
      node: valueNode,
      hint: 'Emit individual flat dotted metrics instead of object blobs.',
    }));
    return;
  }

  if (classified.kind === VALUE_KINDS.ARRAY) {
    for (const element of classified.elements) {
      if (![VALUE_KINDS.INTEGER, VALUE_KINDS.FLOAT, VALUE_KINDS.BOOLEAN, VALUE_KINDS.IDENTIFIER].includes(element.kind)) {
        diagnostics.push(diagnostic({
          code: 'SATJS_TELEMETRY_VALUE',
          message: `telemetry arrays cannot contain ${element.kind} values.`,
          node: element.node,
        }));
      }
    }
  }
}

function getObjectKeyName(node) {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'StringLiteral') {
    return node.value;
  }
  if (node.type === 'NumericLiteral') {
    return String(node.value);
  }
  return undefined;
}
