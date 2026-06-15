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

export function formatDiagnostics(diagnostics, filename = '<input>') {
  return diagnostics
    .map((d) => {
      const where = d.loc ? `${filename}:${d.loc.line}:${d.loc.column}` : filename;
      const hint = d.hint ? `\n  hint: ${d.hint}` : '';
      return `${where}: ${d.severity} ${d.code}: ${d.message}${hint}`;
    })
    .join('\n');
}
