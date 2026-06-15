export class TranspileError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'TranspileError';
    this.diagnostics = diagnostics;
  }
}

export function diagnostic({ code, message, node, severity = 'error', hint }) {
  return {
    severity,
    code,
    message,
    hint,
    loc: node?.loc?.start
      ? {
          line: node.loc.start.line,
          column: node.loc.start.column + 1,
        }
      : undefined,
  };
}

export function formatDiagnostics(diagnostics, filename = '<input>', source = undefined) {
  const lines = typeof source === 'string' ? source.split(/\r?\n/u) : undefined;
  return diagnostics
    .map((d) => {
      const where = d.loc ? `${filename}:${d.loc.line}:${d.loc.column}` : filename;
      const hint = d.hint ? `\n  hint: ${d.hint}` : '';
      const snippet = formatSnippet(lines, d.loc);
      return `${where}: ${d.severity} ${d.code}: ${d.message}${snippet}${hint}`;
    })
    .join('\n');
}

function formatSnippet(lines, loc) {
  if (!lines || !loc?.line) {
    return '';
  }
  const lineText = lines[loc.line - 1];
  if (lineText === undefined) {
    return '';
  }
  const caretColumn = Math.max(1, loc.column ?? 1);
  return `\n  ${lineText}\n  ${' '.repeat(caretColumn - 1)}^`;
}
