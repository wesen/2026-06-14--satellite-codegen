# Satellite JS C++ Transpiler

`satjs-cpp` transpiles deterministic JavaScript mission scripts written against the `satellite-os` API contract in `source/satellite-js.md` into auditable C++.

It is a focused mission-script compiler, not a general JavaScript runtime.

## Quick start

```bash
npm ci
npm test
npm run transpile:example
npm run compile:example
```

Generate C++:

```bash
node ./src/cli.js examples/housekeeping.js --out build/housekeeping.cpp
```

Validate only:

```bash
node ./src/cli.js examples/housekeeping.js --check
```

Inspect compiler internals:

```bash
node ./src/cli.js examples/housekeeping.js --dump-ast
node ./src/cli.js examples/housekeeping.js --dump-ir
```

Add source line comments to generated C++:

```bash
node ./src/cli.js examples/housekeeping.js --source-comments --out build/housekeeping.cpp
```

## Supported source shape

Mission scripts may import named APIs from `satellite-os` and relative driver/helper files. Top-level code should register devices, faults, tasks, and start the scheduler. Runtime behavior belongs inside named functions or task/fault callbacks.

See `docs/supported-subset.md` for the detailed author-facing rules.

## Runtime contract

Generated C++ targets `runtime/satellite_os.hpp`, a compile/link shim that documents the expected `satellite::...` runtime API. It is not flight software. Replace or adapt that layer when integrating with the real runtime.

## Main commands

- `npm test` — JavaScript unit/regression tests.
- `npm run transpile:example` — generate `build/housekeeping.cpp`.
- `npm run compile:example` — generate, compile, and link the example.
- `npm run smoke` — run tests, compile/link, and validate the example.
