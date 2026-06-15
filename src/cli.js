#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import { formatDiagnostics, TranspileError, transpile } from './index.js';

function printUsage() {
  process.stderr.write(`Usage: satjs-cpp <input.js> [--out output.cpp] [--runtime-header satellite_os.hpp]\n`);
}

function parseArgs(argv) {
  const args = {
    input: undefined,
    out: undefined,
    runtimeHeader: 'satellite_os.hpp',
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printUsage();
    process.exitCode = args.help ? 0 : 2;
    return;
  }

  const source = await readFile(args.input, 'utf8');
  const result = transpile(source, {
    filename: args.input,
    runtimeHeader: args.runtimeHeader,
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
    process.stderr.write(`${formatDiagnostics(error.diagnostics)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
