export function getStaticMemberParts(node) {
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

export function unwrapAwait(node) {
  return node?.type === 'AwaitExpression' ? node.argument : node;
}

export function isCallTo(node, parts) {
  if (node?.type !== 'CallExpression') {
    return false;
  }
  const actual = getStaticMemberParts(node.callee);
  return Boolean(actual && actual.length === parts.length && actual.every((part, index) => part === parts[index]));
}

export function getSourceLine(node) {
  return node?.loc?.start?.line;
}
