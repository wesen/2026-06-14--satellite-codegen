import { parseJavaScript } from './parser.js';
import { validateMissionProgram } from './validator.js';
import { SatelliteCppEmitter } from './emitter.js';

export function transpile(source, options = {}) {
  const filename = options.filename ?? '<input>';
  const ast = parseJavaScript(source, filename);
  validateMissionProgram(ast, filename);
  const emitter = new SatelliteCppEmitter({
    filename,
    runtimeHeader: options.runtimeHeader ?? 'satellite_os.hpp',
  });
  return {
    code: emitter.emit(ast),
    diagnostics: [],
  };
}

export { TranspileError, formatDiagnostics } from './diagnostics.js';
