import { parseJavaScript } from './parser.js';
import { buildMissionIR } from './ir.js';
import { validateMissionProgram } from './validator.js';
import { SatelliteCppEmitter } from './emitter.js';

export function transpile(source, options = {}) {
  const filename = options.filename ?? '<input>';
  const ast = parseJavaScript(source, filename);
  validateMissionProgram(ast, filename);
  const runtimeHeader = options.runtimeHeader ?? 'satellite_os.hpp';
  const ir = buildMissionIR(ast, { runtimeHeader });
  const emitter = new SatelliteCppEmitter({
    filename,
    runtimeHeader,
    sourceComments: options.sourceComments ?? false,
  });
  return {
    code: emitter.emitMissionProgram(ir),
    ir,
    diagnostics: [],
  };
}

export function check(source, options = {}) {
  const filename = options.filename ?? '<input>';
  const ast = parseJavaScript(source, filename);
  validateMissionProgram(ast, filename);
  return { diagnostics: [] };
}

export { buildMissionIR, missionIRToJSON } from './ir.js';
export { parseJavaScript } from './parser.js';
export { TranspileError, formatDiagnostics } from './diagnostics.js';
