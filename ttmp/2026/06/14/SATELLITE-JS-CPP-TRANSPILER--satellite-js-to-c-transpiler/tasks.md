# Tasks

## Phase 0 — Ticket, research, and design

- [x] Create docmgr ticket `SATELLITE-JS-CPP-TRANSPILER` with design doc, diary, tasks, and changelog.
- [x] Read and line-reference `source/satellite-js.md` as the source API contract.
- [x] Download parser/AST research material into `source/research/` using Defuddle.
- [x] Write an intern-oriented analysis/design/implementation guide with diagrams, pseudocode, API references, file references, risks, and decision records.
- [x] Upload the design bundle to reMarkable under `/ai/2026/06/14/SATELLITE-JS-CPP-TRANSPILER`.

## Phase 1 — MVP parser, emitter, CLI, and compile smoke test

- [x] Initialize a Node package for `satjs-cpp` and pin `@babel/parser`.
- [x] Implement `src/parser.js` with module parsing, top-level await, numeric separators, and source filenames.
- [x] Implement `src/index.js` with a public `transpile(source, options)` API.
- [x] Implement `src/diagnostics.js` with `TranspileError`, structured diagnostics, and CLI formatting.
- [x] Implement `src/cpp-writer.js` for deterministic indentation and generated text assembly.
- [x] Implement `src/satellite-api.js` for known satellite namespaces and JS-import-to-C++-include helpers.
- [x] Implement `src/emitter.js` with direct AST-to-C++ lowering for imports, functions, statements, literals, objects, arrays, calls, callbacks, and satellite API calls.
- [x] Implement `src/cli.js` with `satjs-cpp <input.js> --out <output.cpp>`.
- [x] Add `runtime/satellite_os.hpp` as a compile-only runtime shim.
- [x] Add `examples/housekeeping.js` and `examples/drivers/eps.hpp`.
- [x] Add `test/transpile.test.js` for positive lowering, device registration, diagnostics, and CLI output.
- [x] Validate with `npm test`.
- [x] Validate with `npm run transpile:example`.
- [x] Validate generated C++ with `c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o`.
- [x] Commit Phase 1 code (`1a427f8`) and keep documentation commit separate.

## Phase 2 — Explicit semantic validation pass

- [x] Create a validation module that runs before emission.
- [x] Reject unsupported imports with stable diagnostic codes.
- [x] Reject `console.*` and suggest `telemetry.emit`.
- [x] Reject `setTimeout` and `setInterval` and suggest `task.every` / scheduler APIs.
- [x] Reject `eval`, `Function`, dynamic `import()`, proxies, and reflection-heavy constructs.
- [x] Enforce top-level boot wiring policy: imports, named functions, constant declarations, `device.register`, `fault.handle`, `task.*`, and `task.start` only.
- [x] Validate `device.register(name, DriverType, options)` arity and ensure `DriverType` resolves to a relative driver import.
- [x] Validate `task.once/every/on` arity and callback shape.
- [x] Validate `fault.handle` arity and callback shape.
- [x] Add negative tests for every forbidden construct.

## Phase 3 — Mission intermediate representation (IR)

- [x] Design `MissionProgram`, `MissionFunction`, `BootOperation`, `CallbackRef`, and `ValueExpr` types.
- [x] Add an AST-to-IR lowering pass for imports and boot wiring.
- [x] Move `device.register`, `task.*`, and `fault.handle` special cases from emitter code into IR lowering.
- [x] Update the C++ emitter to emit from IR for boot operations.
- [x] Add snapshot tests for IR output.
- [x] Keep direct AST statement/expression emission only inside function/callback bodies until those bodies get their own IR.

## Phase 4 — Stronger value and type model

- [x] Define allowed literal value categories: null, boolean, integer, float, string, bytes, array, object.
- [x] Normalize JavaScript numeric separators and validate integer ranges.
- [x] Decide when arrays emit as `satellite::Array`, `satellite::Bytes`, or typed `std::vector<T>`.
- [x] Add schema hooks for driver options and telemetry metric values.
- [x] Add validation for telemetry hot-path restrictions from the source API.
- [x] Add tests for object literals, byte arrays, numeric literals, arrays, and rejected unsupported value shapes.

## Phase 5 — Resource lifecycle analysis

- [x] Track resource handles returned by `bus.open` and `device.acquire` within a function/callback.
- [x] Warn or fail when a handle is obviously not closed/released.
- [x] Recognize deliberate transfers to helper functions once a transfer convention exists.
- [x] Validate no interleaved unsafe bus transaction pattern is introduced by lowering.
- [x] Add tests for correct close/release, missing close/release, and conditional cleanup paths.

## Phase 6 — Runtime integration

- [x] Replace or supplement `runtime/satellite_os.hpp` with headers matching the real flight runtime.
- [x] Decide whether real runtime errors are exceptions, `expected`/status returns, or scheduler-managed failures.
- [x] Align `satellite::Error` with the JS structured error contract.
- [x] Link a generated example against the real runtime library.
- [x] Add CI compile/link tests once runtime dependencies are available.

## Phase 7 — Developer experience and packaging

- [x] Add `--check` mode for validation-only runs.
- [x] Add `--dump-ast` for parser debugging.
- [x] Add `--dump-ir` after Phase 3.
- [x] Add source snippets to diagnostics.
- [x] Add generated-source line comments or source maps.
- [x] Add README usage examples and a supported-subset guide for mission script authors.
- [x] Add npm package metadata and release checklist.

## Phase 8 — Hardening and long-term quality

- [x] Add golden-output tests for every supported satellite API call.
- [x] Add negative diagnostics tests for every unsupported AST category.
- [x] Add C++ formatting or stable formatting rules.
- [x] Add fuzz/snapshot coverage for unsupported syntax to prevent crashes.
- [x] Add performance smoke tests for larger mission scripts.
- [x] Add architecture docs for future maintainers when IR and runtime integration land.

## Phase 9 — Demo ladder and C++ emulator harness

- [x] Add a progression of demo JS programs from minimal boot telemetry through realistic mission-loop complexity.
- [x] Replace the no-op C++ runtime shim with a deterministic emulator for bus/device/task/telemetry/fault behavior.
- [x] Add demo runners and driver stubs needed to compile generated C++ binaries.
- [x] Extend the Makefile with demo check/transpile/compile/run/validate targets.
- [x] Validate all demos with `make demos-validate` and include demo validation in `make smoke`.
- [x] Document the demo ladder and emulator behavior in `docs/demo-programs.md`, `docs/emulator.md`, and README updates.
- [x] Update CI to run `make smoke`.
