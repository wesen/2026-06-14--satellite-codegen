#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import {
  buildMissionIR,
  check,
  formatDiagnostics,
  missionIRToJSON,
  parseJavaScript,
  TranspileError,
  transpile,
} from './index.js';

function printUsage() {
  process.stderr.write(`Usage: satjs-cpp <input.js> [--out output.cpp] [--runtime-header satellite_os.hpp]\n\nOptions:\n  --check             Validate only; do not emit C++.\n  --dump-ast          Print the Babel AST as JSON.\n  --dump-ir           Print the mission IR as JSON.\n  --source-comments   Add // JS line N comments to generated C++.\n  -o, --out <path>    Write generated C++ to a file.\n  -h, --help          Show this help.\n`);
}

function parseArgs(argv) {
  const args = {
    input: undefined,
    out: undefined,
    runtimeHeader: 'satellite_os.hpp',
    check: false,
    dumpAst: false,
    dumpIr: false,
    sourceComments: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out' || arg === '-o') {
      args.out = argv[++i];
      continue;
    }
    if (arg === '--runtime-header') {
      args.runtimeHeader = argv[++i];
      continue;
    }
    if (arg === '--check') {
      args.check = true;
      continue;
    }
    if (arg === '--dump-ast') {
      args.dumpAst = true;
      continue;
    }
    if (arg === '--dump-ir') {
      args.dumpIr = true;
      continue;
    }
    if (arg === '--source-comments') {
      args.sourceComments = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (args.input) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    args.input = arg;
  }

  return args;
}

let activeFilename = '<input>';
let activeSource;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printUsage();
    process.exitCode = args.help ? 0 : 2;
    return;
  }

  activeFilename = args.input;
  activeSource = await readFile(args.input, 'utf8');

  if (args.dumpAst) {
    const ast = parseJavaScript(activeSource, args.input);
    process.stdout.write(`${JSON.stringify(ast, null, 2)}\n`);
    return;
  }

  if (args.dumpIr) {
    const ast = parseJavaScript(activeSource, args.input);
    check(activeSource, { filename: args.input });
    const ir = buildMissionIR(ast, { runtimeHeader: args.runtimeHeader });
    process.stdout.write(`${missionIRToJSON(ir)}\n`);
    return;
  }

  if (args.check) {
    check(activeSource, { filename: args.input });
    process.stdout.write(`OK: ${args.input}\n`);
    return;
  }

  const result = transpile(activeSource, {
    filename: args.input,
    runtimeHeader: args.runtimeHeader,
    sourceComments: args.sourceComments,
  });

  if (args.out) {
    await mkdir(dirname(args.out), { recursive: true });
    await writeFile(args.out, result.code, 'utf8');
    return;
  }

  process.stdout.write(result.code);
}

main().catch((error) => {
  if (error instanceof TranspileError) {
    process.stderr.write(`${formatDiagnostics(error.diagnostics, activeFilename, activeSource)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
