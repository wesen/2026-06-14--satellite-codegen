# Satellite JS C++ Transpiler

`satjs-cpp` transpiles deterministic JavaScript mission scripts written against the `satellite-os` API contract in `source/satellite-js.md` into auditable C++.

It is a focused mission-script compiler, not a general JavaScript runtime.

## Quick start

```bash
npm ci
make smoke
```

Equivalent npm commands:

```bash
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

## Demo suite and emulator

The repository includes a demo ladder under `examples/demos/`, ranging from a minimal boot beacon to a realistic multi-subsystem mission loop. The demos are transpiled, compiled, linked, and executed against the local C++ emulator.

```bash
make demos-validate
```

See:

- `docs/demo-programs.md` for the demo progression and what each script exercises.
- `docs/emulator.md` for the emulator model, simulated conditions, and runtime report.

## Runtime contract

Generated C++ targets `runtime/satellite_os.hpp`, an executable emulator/runtime shim that documents the expected `satellite::...` runtime API. It is not flight software. Replace or adapt that layer when integrating with the real runtime.

## Makefile commands

- `make test` — run the Node test suite.
- `make check` — validate `examples/housekeeping.js` without emitting C++.
- `make transpile-example` — generate `build/housekeeping.cpp`.
- `make compile-example` — generate and compile/link `build/housekeeping`.
- `make run-example` — run the linked example binary.
- `make demos-check` — validate every demo JS script.
- `make demos-transpile` — generate C++ for every demo under `build/demos/`.
- `make demos-compile` — compile/link every generated demo binary.
- `make demos-run` — execute every demo under the emulator.
- `make demos-validate` — check, transpile, compile, and run every demo.
- `make smoke` — run tests, compile/link, validate the example, and validate all demos.
- `make dump-ir` / `make dump-ast` — inspect compiler internals.
- `make docs` — run `docmgr doctor` for the ticket.
- `make clean` — remove `build/`.

## NPM commands

- `npm test` — JavaScript unit/regression tests.
- `npm run transpile:example` — generate `build/housekeeping.cpp`.
- `npm run compile:example` — generate, compile, and link the example.
- `npm run validate:demos` — check, transpile, compile, and run every demo through `make demos-validate`.
- `npm run smoke` — run tests, compile/link, validate the example, and validate all demos.
