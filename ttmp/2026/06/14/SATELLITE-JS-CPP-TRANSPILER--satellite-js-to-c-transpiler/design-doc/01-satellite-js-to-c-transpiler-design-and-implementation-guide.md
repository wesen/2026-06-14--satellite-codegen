---
Title: Satellite JS to C++ Transpiler Design and Implementation Guide
Ticket: SATELLITE-JS-CPP-TRANSPILER
Status: active
Topics:
    - transpiler
    - codegen
    - satellite-js
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: Makefile
      Note: Example transpile/compile/smoke entrypoints added for final handoff
    - Path: README.md
      Note: User-facing quickstart and Makefile commands
    - Path: runtime/satellite_os.hpp
      Note: Compile-only runtime shape expected by generated C++
    - Path: source/research/babel-parser.md
      Note: Local parser API reference used by the design
    - Path: source/research/esprima-syntax-tree-format.md
      Note: Local AST shape reference used by the design
    - Path: source/satellite-js.md
      Note: Source API contract that defines bus/device/task/telemetry/fault semantics
    - Path: src/emitter.js
      Note: Main AST-to-C++ lowering implementation
    - Path: src/ir.js
      Note: Mission IR builder added in Phase 3
    - Path: src/parser.js
      Note: Babel parser configuration for mission scripts
    - Path: src/resource-analysis.js
      Note: Resource lifecycle analysis added in Phase 5
    - Path: src/schemas.js
      Note: Driver and telemetry schema checks added in Phase 4
    - Path: src/value-model.js
      Note: Mission value classification added in Phase 4
    - Path: test/hardening.test.js
      Note: Golden
    - Path: test/transpile.test.js
      Note: Regression tests for lowering
ExternalSources:
    - https://babeljs.io/docs/babel-parser
    - https://babeljs.io/docs/babel-traverse
    - https://esprima.readthedocs.io/en/latest/syntax-tree-format.html
Summary: Design and implementation guide for a focused JavaScript-to-C++ transpiler for satellite-os mission scripts.
LastUpdated: 2026-06-15T02:45:00-04:00
WhatFor: Onboard a new intern to the satellite-os API contract, the JS subset, the compiler pipeline, the generated C++ runtime shape, and the phased implementation plan.
WhenToUse: Use before changing the transpiler, adding a lowering rule, reviewing generated C++, or deciding whether a JS construct belongs in the supported mission-script subset.
---



# Satellite JS to C++ Transpiler Design and Implementation Guide

## Executive Summary

This ticket builds a focused transpiler named `satjs-cpp`. It takes mission scripts written in JavaScript against the `satellite-os` API contract described in `source/satellite-js.md`, parses those scripts into a JavaScript abstract syntax tree (AST), validates that the script only uses the supported deterministic subset, and emits C++ that calls an equivalent `satellite::...` runtime API.

The project is intentionally not a general JavaScript runtime, not a JavaScript-to-C++ whole-language compiler, and not a replacement for mission-specific C++ drivers. Its job is narrower and safer: make the small `satellite-os` kernel surface comfortable to author in JavaScript while producing auditable C++ that flight engineers can inspect, compile, and link into a constrained onboard runtime.

The current repository now contains an MVP implementation:

- `package.json` and `package-lock.json` define the Node package and pin `@babel/parser`.
- `src/parser.js` parses module JavaScript with top-level `await` support.
- `src/validator.js` enforces the Phase 2 mission-script subset before C++ emission.
- `src/emitter.js` lowers a supported AST subset into C++.
- `src/cli.js` exposes `satjs-cpp <input.js> --out <output.cpp>`.
- `runtime/satellite_os.hpp` is a compile-only runtime shim used by tests and examples.
- `examples/housekeeping.js` is a realistic mission-script input.
- `test/transpile.test.js` verifies core lowering and CLI behavior.

The design below is written for a new intern. Read it in order the first time. After that, the most useful sections are **System Map**, **Source API Contract**, **Compiler Pipeline**, **Lowering Rules**, **Implementation Phases**, and **Code Review Checklist**.

## Problem Statement and Scope

Mission authors want to write small onboard automation scripts using the `satellite-os` JavaScript API:

```js
import { bus, device, task, telemetry, fault } from 'satellite-os'

task.every('housekeeping', '30s', async (ctx) => {
  const i2c = await bus.open('i2c0', { clockHz: 400_000 })
  const response = await i2c.transact({ address: 0x48, write: Uint8Array.of(0x00), readLength: 2 })
  telemetry.emit('eps.raw_temperature_frame', response)
  await i2c.close()
})
```

Onboard flight software, however, usually wants C++ because it is easier to compile into firmware, audit for memory/runtime behavior, integrate with existing device drivers, and link without embedding a JavaScript engine. The requested system therefore translates the script into C++ such as:

```cpp
auto satellite_main() {
  satellite::task::every("housekeeping", "30s", [&](auto&& ctx) {
    auto i2c = satellite::bus::open("i2c0", satellite::Object{{"clockHz", 400000}});
    auto response = i2c.transact(satellite::Object{{"address", 0x48}, {"write", satellite::Bytes{0x00}}, {"readLength", 2}});
    satellite::telemetry::emit("eps.raw_temperature_frame", response);
    i2c.close();
  });
}
```

### In scope

The first implementation focuses on deterministic mission scripts that look like the examples in `source/satellite-js.md`:

- Named imports from `satellite-os`: `bus`, `device`, `task`, `telemetry`, `fault`.
- Relative imports for driver/helper declarations, translated from `.js` to `.hpp` includes.
- Top-level boot wiring: `device.register`, `fault.handle`, `task.once`, `task.every`, `task.on`, `task.start`.
- Named function declarations and lambda/arrow callbacks.
- `await` on synchronous-looking satellite calls, erased in generated C++ because the C++ runtime owns scheduling.
- Plain object literals for options/evidence/configuration.
- Arrays and `Uint8Array.of(...)` for telemetry values and bus payloads.
- Control flow needed by small mission tasks: `if`, `for`, `while`, `return`, `try/catch`, `break`, `continue`.

### Out of scope for now

The source API itself explicitly excludes several runtime features. The transpiler should preserve that philosophy rather than smuggling the features back in:

- No `setTimeout` or `setInterval`; use `task.every` instead (`source/satellite-js.md:181-189`).
- No `console.*`; use `telemetry.emit` (`source/satellite-js.md:181-189`).
- No filesystem assumptions; use telemetry/ring-buffer APIs (`source/satellite-js.md:181-189`).
- No arbitrary npm dependencies; import mission/platform functionality through drivers.
- No dynamic code execution: `eval`, `Function`, dynamic `import()`, proxies, reflection-heavy patterns, or runtime monkey-patching.
- No full JavaScript object model. The target is C++ mission code, not a JS VM.

## System Map

The transpiler is a small compiler pipeline. Each stage has one responsibility and should stay testable in isolation.

```text
+----------------------+      +--------------------+      +----------------------+
| mission JS source    | ---> | Babel parser AST   | ---> | semantic validation  |
| examples/*.js        |      | src/parser.js      |      | import/API subset    |
+----------------------+      +--------------------+      +----------------------+
                                                               |
                                                               v
+----------------------+      +--------------------+      +----------------------+
| generated .cpp       | <--- | C++ emitter        | <--- | lowering decisions   |
| build/*.cpp          |      | src/emitter.js     |      | satellite API map    |
+----------------------+      +--------------------+      +----------------------+
          |
          v
+----------------------+      +--------------------+
| C++ compiler         | ---> | firmware/runtime   |
| c++ -std=c++20       |      | satellite::... API |
+----------------------+      +--------------------+
```

The repository layout is:

```text
/home/manuel/code/wesen/2026-06-14--satellite-codegen/
├── source/
│   ├── satellite-js.md                         # Source API contract from the user.
│   └── research/                               # Downloaded reference material.
│       ├── babel-parser.md
│       ├── babel-traverse.md
│       ├── babel-types.md
│       └── esprima-syntax-tree-format.md
├── src/
│   ├── cli.js                                  # Command-line entrypoint.
│   ├── index.js                                # Public transpile() API.
│   ├── parser.js                               # Babel parser wrapper.
│   ├── validator.js                            # Mission subset validation pass.
│   ├── emitter.js                              # Main AST-to-C++ emitter.
│   ├── cpp-writer.js                           # Indentation/text helper.
│   ├── diagnostics.js                          # Error/diagnostic model.
│   └── satellite-api.js                        # satellite-os names and include helpers.
├── runtime/
│   └── satellite_os.hpp                        # Compile-only C++ shim for tests/examples.
├── examples/
│   ├── housekeeping.js                         # Example mission script.
│   └── drivers/eps.hpp                         # Example driver declaration.
├── test/
│   └── transpile.test.js                       # Node test suite.
└── ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/
    ├── design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md
    ├── reference/01-diary.md
    ├── tasks.md
    └── changelog.md
```

## Source API Contract: What `satellite-os` Means

The most important source document is `source/satellite-js.md`. It defines the surface area that mission JS scripts are allowed to use. The transpiler should be treated as an implementation of this contract, not as an independent language design.

### Core imports

The kernel surface is the five namespaces exported by `satellite-os`:

```js
import { bus, device, task, telemetry, fault } from 'satellite-os'
```

The contract shows those namespaces at `source/satellite-js.md:11-23`. The transpiler recognizes named imports from the exact module string `satellite-os` and records which local identifiers correspond to those namespaces. Aliased imports should lower correctly because the emitter stores local-to-imported names.

### `bus`: hardware bus access

`bus` is the low-level hardware access layer. The contract says a script opens a named bus and calls `transact` with one atomic write/read operation (`source/satellite-js.md:27-50`). Example source:

```js
const i2c = await bus.open('i2c0', { clockHz: 400_000 })
const response = await i2c.transact({
  address: 0x48,
  write: Uint8Array.of(0x00),
  readLength: 2,
})
await i2c.close()
```

Generated C++ should preserve the lifecycle:

```cpp
auto i2c = satellite::bus::open("i2c0", satellite::Object{{"clockHz", 400000}});
auto response = i2c.transact(satellite::Object{{"address", 0x48}, {"write", satellite::Bytes{0x00}}, {"readLength", 2}});
i2c.close();
```

Important details for interns:

- JavaScript `const` means the binding cannot be rebound; it does **not** make the handle object immutable.
- C++ `const auto i2c` would prevent calling non-const lifecycle methods such as `close()`.
- The emitter therefore currently emits local variables as `auto`, even for JS `const` (`src/emitter.js:210-220`).
- `Uint8Array.of(...)` is a special source idiom for byte payloads and lowers to `satellite::Bytes{...}` (`src/emitter.js:394-396`).

### `device`: named subsystem drivers

`device` registers and acquires named drivers. The contract states that drivers wrap bus access and expose typed subsystem methods (`source/satellite-js.md:54-76`). Source:

```js
import { device } from 'satellite-os'
import { EPSDriver } from './drivers/eps.js'

device.register('eps', EPSDriver, { bus: 'i2c0', address: 0x20 })
```

Generated C++:

```cpp
#include "drivers/eps.hpp"

satellite::device::register_driver<EPSDriver>(
  "eps",
  satellite::Object{{"bus", "i2c0"}, {"address", 0x20}}
);
```

Current lowering is implemented as a special case because C++ needs the driver type as a template parameter, not as a runtime object (`src/emitter.js:416-427`).

### `task`: scheduled work

`task` is the scheduler API. The contract defines one-shot tasks, recurring tasks, and event-triggered tasks (`source/satellite-js.md:80-107`). Source:

```js
task.once('boot-selftest', selftestTask)

task.every('housekeeping', '30s', async (ctx) => {
  if (ctx.iteration > 1000) ctx.stop()
})

task.on('cmd:reboot', async (payload) => {
  await task.shutdown({ gracePeriodMs: 500 })
})
```

Generated C++ should keep registration visible and named:

```cpp
satellite::task::once("boot-selftest", [&](auto&&... args) { return selftestTask(args...); });
satellite::task::every("housekeeping", "30s", [&](auto&& ctx) {
  if ((ctx.iteration > 1000)) {
    ctx.stop();
  }
});
```

The callback wrapper is intentional. A JS function with a parameter currently emits as an abbreviated C++ function template, such as `auto handler(auto&& ctx)`. A function template name cannot always be passed directly as a value. Wrapping it in a generic lambda makes the generated code compile and keeps callback invocation explicit (`src/emitter.js:444-462`).

### `telemetry`: structured observability

`telemetry` replaces console logging and unstructured output. The contract says telemetry emits flat dotted metrics, supports snapshots, and supports onboard watchers (`source/satellite-js.md:111-134`). Current MVP lowering handles direct calls by namespace mapping:

```js
telemetry.emit('thermal.panel_temp_c', 42.7)
```

```cpp
satellite::telemetry::emit("thermal.panel_temp_c", 42.7);
```

Follow-up work should make value typing stricter: primitive, arrays, bytes, and small objects are okay; arbitrary strings or blobs in hot paths should be diagnosed according to the source contract.

### `fault`: first-class fault handling

`fault` represents named, counted, timestamped fault events, not thrown exceptions (`source/satellite-js.md:138-161`). Source:

```js
fault.raise('EPS_UNDERVOLTAGE', { volts: 2.8, threshold: 3.0 })
fault.handle('EPS_UNDERVOLTAGE', async (ctx) => {
  await task.pause('payload-camera', '5m')
  if (ctx.count > 3) fault.escalate(ctx)
})
```

Generated C++:

```cpp
satellite::fault::raise("EPS_UNDERVOLTAGE", satellite::Object{{"volts", 2.8}, {"threshold", 3.0}});
satellite::fault::handle("EPS_UNDERVOLTAGE", [&](auto&& ctx) {
  satellite::task::pause("payload-camera", "5m");
  if ((ctx.count > 3)) {
    satellite::fault::escalate(ctx);
  }
});
```

### Error contract

The source contract says async API calls reject with structured errors containing fields like `code`, `source`, `task`, and `ts` (`source/satellite-js.md:165-177`). The current generated C++ catches `satellite::Error` in `try/catch` lowering (`src/emitter.js:248-260`). Follow-up work should align `runtime/satellite_os.hpp` and real runtime implementations with that error schema.

## Research Sources Stored in `source/research`

The research files are stored locally so future agents and interns do not need to repeat web discovery before understanding the parser choices.

- `source/research/babel-parser.md` explains `@babel/parser.parse(code, options)` and says `parse()` parses an entire ECMAScript program (`source/research/babel-parser.md:18-23`). It also documents `sourceType` and module parsing options (`source/research/babel-parser.md:84-89`) and notes that Babel emits a Babel AST based on ESTree (`source/research/babel-parser.md:110-112`).
- `source/research/babel-traverse.md` shows the standard Babel visitor style for walking or changing AST nodes (`source/research/babel-traverse.md:21-37`). The MVP emitter uses direct recursive methods rather than `@babel/traverse`; a future semantic pass may use visitors.
- `source/research/esprima-syntax-tree-format.md` gives the ESTree mental model: each node has a `type` (`source/research/esprima-syntax-tree-format.md:13-17`), location metadata may include line/column (`source/research/esprima-syntax-tree-format.md:26-38`), expressions include call/await/binary/member forms (`source/research/esprima-syntax-tree-format.md:59-64`), and modules contain import/export declarations (`source/research/esprima-syntax-tree-format.md:712-734`).
- `source/research/babel-types.md` is a large generated reference for concrete Babel node shapes, useful when adding new AST node support.

## Compiler Pipeline in Detail

### Stage 1: CLI and public API

The command-line entrypoint is `src/cli.js`. It parses:

```text
satjs-cpp <input.js> [--out output.cpp] [--runtime-header satellite_os.hpp]
```

Important code references:

- `src/cli.js:7-9` prints the CLI usage string.
- `src/cli.js:11-42` parses options without an external CLI dependency.
- `src/cli.js:52-64` reads the input, calls `transpile()`, and writes either `--out` or stdout.
- `src/cli.js:67-75` formats `TranspileError` diagnostics and exits non-zero.

The public JavaScript API is `transpile(source, options)` in `src/index.js`. It parses, validates, and emits C++. It returns:

```js
{
  code: "// generated C++ ...",
  diagnostics: []
}
```

In the future, warnings can be returned in `diagnostics` without throwing. Fatal errors currently throw `TranspileError`.

### Stage 2: parsing

`src/parser.js` wraps Babel parser:

```js
parse(source, {
  sourceType: 'module',
  sourceFilename: filename,
  errorRecovery: false,
  allowReturnOutsideFunction: false,
  plugins: ['topLevelAwait', 'numericSeparator', 'objectRestSpread'],
})
```

Why this matters:

- `sourceType: 'module'` is required for `import { task } from 'satellite-os'`.
- `topLevelAwait` matches the style of mission boot scripts that may use `await` at top-level.
- `numericSeparator` lets source scripts write `400_000` for readability.
- `errorRecovery: false` is deliberate. In flight-code generation, a parse error should fail fast instead of producing partial output.

### Stage 3: semantic validation

The Phase 2 implementation now validates the mission-script subset before emission. The validation pass lives in `src/validator.js` and is invoked by `transpile()` before constructing the emitter.

The validator currently checks:

- unsupported imports with stable `SATJS_IMPORT_UNSUPPORTED` diagnostics,
- `console.*` with a `telemetry.emit` hint,
- `setTimeout` / `setInterval` with scheduler hints,
- `eval`, `new Function`, dynamic `import()`, `new Proxy`, and `Reflect.*`,
- top-level boot wiring policy,
- `device.register` arity and relative driver-import requirement,
- `task.once/every/on` arity and callback shape,
- `fault.handle` arity and callback shape.

The validator does not replace the emitter's defensive checks. It catches mission-policy errors earlier and gives better diagnostics; the emitter still rejects unsupported AST nodes that survive validation.

### Stage 4: import collection

The emitter scans import declarations (`src/emitter.js:128-159`). There are two supported import categories:

1. Exact `satellite-os` imports.
2. Relative imports such as `./drivers/eps.js`, translated to `#include "drivers/eps.hpp"`.

Unsupported imports produce a diagnostic. This prevents accidental use of Node APIs or npm packages in mission code.

Pseudocode:

```text
for statement in program.body:
  if statement is not ImportDeclaration:
    continue

  if source == "satellite-os":
    for named specifier:
      satelliteImports[localName] = importedName
    continue

  if source starts with ".":
    localIncludes.add(jsPathToHppPath(source))
    continue

  error("Unsupported import source")
```

### Stage 5: program partitioning

The emitter separates function declarations from top-level boot wiring (`src/emitter.js:74-123`). This is a simple but important convention:

- Named functions are emitted above `satellite_main()`.
- Top-level statements become the body of `satellite_main()`.
- Imports disappear after they have contributed includes/import metadata.

This maps the boot sequence shown in `source/satellite-js.md:193-215` to C++:

```text
JS main.js top level              Generated C++
-----------------------------    --------------------------------
import ...                        #include ...
function handler(...) { ... }     auto handler(...) { ... }
device.register(...)              auto satellite_main() {
fault.handle(...)                   satellite::device::register_driver(...);
task.every(...)                     satellite::fault::handle(...);
task.start()                        satellite::task::every(...);
                                  }
```

### Stage 6: statement and expression emission

The core of `src/emitter.js` is a recursive AST printer:

- `emitStatement(node, writer)` handles statements (`src/emitter.js:171-201`).
- `emitExpression(node)` handles expressions (`src/emitter.js:271-312`).
- `emitCallExpression(node)` detects special calls such as `Date.now`, `Uint8Array.of`, and `satellite-os` namespace calls (`src/emitter.js:387-414`).
- `emitSatelliteCall(...)` applies API-specific lowering (`src/emitter.js:416-442`).

Pseudocode:

```text
function emitExpression(node):
  switch node.type:
    Identifier       -> identifier with C++ reserved word escaping
    NumericLiteral   -> raw number with JS separators normalized
    StringLiteral    -> JSON-escaped C++ string literal
    ObjectExpression -> satellite::Object{ {key, value}, ... }
    ArrayExpression  -> satellite::Array{ value, ... }
    AwaitExpression  -> emitExpression(argument)
    CallExpression   -> special-case satellite API, otherwise normal call
    MemberExpression -> object.property or object[index]
    ArrowFunction    -> C++ lambda
    otherwise        -> diagnostic unsupported syntax
```

### Stage 7: diagnostics

Diagnostics live in `src/diagnostics.js`:

- `TranspileError` carries one or more diagnostics (`src/diagnostics.js:1-7`).
- `diagnostic(...)` records code, message, severity, hint, and source line/column (`src/diagnostics.js:9-22`).
- `formatDiagnostics(...)` prints human-readable CLI output (`src/diagnostics.js:24-32`).

Unsupported syntax should always fail with a diagnostic that tells the script author what to do next. Do not silently produce questionable C++.

## Lowering Rule Reference

This table summarizes the current lowering rules and likely follow-up work.

| Source JS pattern | Generated C++ pattern | Implemented? | Notes |
|---|---|---:|---|
| `import { task } from 'satellite-os'` | metadata only; include runtime header | yes | Stored in `satelliteImports`. |
| `import { EPSDriver } from './drivers/eps.js'` | `#include "drivers/eps.hpp"` | yes | See `modulePathToHeader` in `src/satellite-api.js:15-22`. |
| `device.register('eps', EPSDriver, opts)` | `satellite::device::register_driver<EPSDriver>("eps", opts)` | yes | Special case because driver type is a C++ template argument. |
| `task.once(name, fn)` | `satellite::task::once(name, callback)` | yes | Identifier callbacks wrap in generic lambda. |
| `task.every(name, period, cb)` | `satellite::task::every(name, period, cb)` | yes | Period currently remains a string. |
| `task.on(pattern, cb)` | `satellite::task::on(pattern, cb)` | yes | Pattern remains a string. |
| `fault.handle(name, cb)` | `satellite::fault::handle(name, cb)` | yes | Identifier callbacks wrap in generic lambda. |
| `telemetry.emit(name, value)` | `satellite::telemetry::emit(name, value)` | yes | Needs stricter value validation later. |
| `bus.open(name, opts)` | `satellite::bus::open(name, opts)` | yes | `await` erased. |
| `i2c.transact(opts)` | `i2c.transact(opts)` | yes | Method call preserved on handle. |
| `Uint8Array.of(0x00)` | `satellite::Bytes{0x00}` | yes | Special case in call emission. |
| `Date.now()` | `satellite::clock::now_ms()` | yes | Needed by telemetry snapshots. |
| object literal | `satellite::Object{{"k", v}}` | yes | No spread/computed keys yet. |
| array literal | `satellite::Array{...}` | yes | Sparse arrays rejected. |
| `try/catch` | `try` / `catch (const satellite::Error& e)` | partial | No `finally`. |
| classes | C++ class or driver binding | no | Keep drivers in C++ for now. |
| destructuring | explicit locals | no | Add only after semantic validation exists. |
| optional chaining | explicit null/error handling | no | Avoid until runtime nullability is designed. |
| dynamic import | none | no | Should remain unsupported. |
| `console.*` | diagnostic; use telemetry | planned | Enforces API contract. |
| `setTimeout` / `setInterval` | diagnostic; use task API | planned | Enforces API contract. |

## Generated Runtime Shape

The generated C++ assumes a runtime namespace named `satellite`. The compile-only shim in `runtime/satellite_os.hpp` defines the shape that generated code currently expects:

- `satellite::Value`, `satellite::Object`, `satellite::Array`, and `satellite::Bytes` (`runtime/satellite_os.hpp:16-32`).
- `satellite::Error` with structured fields (`runtime/satellite_os.hpp:34-41`).
- `satellite::bus::open` and `bus::Handle::transact/close` (`runtime/satellite_os.hpp:47-54`).
- `satellite::device::register_driver`, `acquire`, and `release` (`runtime/satellite_os.hpp:56-67`).
- `satellite::telemetry::emit`, `snapshot`, and `watch` (`runtime/satellite_os.hpp:69-75`).
- `satellite::fault::raise`, `handle`, `list`, and `escalate` (`runtime/satellite_os.hpp:77-89`).
- `satellite::task::once`, `every`, `on`, `start`, `shutdown`, and `pause` (`runtime/satellite_os.hpp:91-109`).

This header is not flight-ready. It is a compile target for generated-code tests. The flight runtime must replace no-op functions with real bus locking, device acquisition, scheduler registration, telemetry buffering, and fault handling.

## End-to-End Example

Input: `examples/housekeeping.js`.

```js
import { bus, device, task, telemetry, fault } from 'satellite-os'
import { EPSDriver } from './drivers/eps.js'

function selftestTask() {
  telemetry.emit('boot.selftest_started', true)
}

device.register('eps', EPSDriver, { bus: 'i2c0', address: 0x20 })
task.once('boot-selftest', selftestTask)
task.every('housekeeping', '30s', async (ctx) => {
  const i2c = await bus.open('i2c0', { clockHz: 400_000 })
  const response = await i2c.transact({ address: 0x48, write: Uint8Array.of(0x00), readLength: 2 })
  telemetry.emit('eps.raw_temperature_frame', response)
  await i2c.close()
})
task.start()
```

Command:

```bash
npm run transpile:example
c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o
```

Expected properties:

- Output includes `#include "satellite_os.hpp"` and `#include "drivers/eps.hpp"`.
- Top-level registration code is inside `auto satellite_main()`.
- `device.register` is a typed C++ registration.
- `await` does not appear in generated C++.
- JS numeric separators are normalized (`400_000` -> `400000`).
- Generated C++ compiles with the shim header.

## Safety and Determinism Rules

The `satellite-os` design is about resource lifecycle and auditability. The transpiler must reinforce that design.

### Rule 1: Only explicit resources

The API contract says everything is a resource with a lifecycle (`source/satellite-js.md:5-8`). Generated C++ should therefore make acquisition and release visible. Do not add hidden retry loops, hidden global state, or implicit cleanup unless the runtime API explicitly provides it.

### Rule 2: Fail on unsupported semantics

If a JS construct has unclear C++ behavior, emit a diagnostic. Examples:

- object spread in mission options,
- computed object keys,
- sparse arrays,
- dynamic imports,
- `eval`,
- `console.log`,
- `setInterval`,
- implicit top-level side effects that are not boot wiring.

### Rule 3: Preserve names

Task names, fault names, telemetry metric names, and driver names must survive lowering exactly. These names are how operators debug the system from telemetry and fault logs.

### Rule 4: Keep generated C++ boring

Generated code should prefer straightforward C++ over clever templates. The runtime can use templates internally where needed, but generated mission code should read like hand-written registration and task code.

## Decision Records

### Decision: Build a focused transpiler instead of embedding a JS runtime

- **Context:** The source scripts use a small mission API, while the target environment values deterministic C++ and auditability.
- **Options considered:** Embed a JS engine; compile all JS semantics to C++; support a restricted mission subset and emit direct C++ API calls.
- **Decision:** Support a restricted mission-script subset and emit direct C++ API calls.
- **Rationale:** The source contract is small, resource-oriented, and already excludes much of the dynamic JS runtime. A focused compiler is easier to inspect and test.
- **Consequences:** Some JavaScript code will be rejected. Diagnostics and docs must be clear so authors understand the supported subset.
- **Status:** accepted.

### Decision: Use Babel parser for the MVP

- **Context:** The transpiler needs a reliable parser with module imports, top-level await, numeric separators, and location metadata.
- **Options considered:** Write a parser; use Esprima/Acorn; use Babel parser; use TypeScript parser.
- **Decision:** Use `@babel/parser`.
- **Rationale:** Babel parser directly supports the syntax needed by the source examples, has documented options, and produces node locations for diagnostics.
- **Consequences:** The emitter must handle Babel AST node names such as `StringLiteral` and `ObjectProperty`, not pure ESTree `Literal` nodes.
- **Status:** accepted.

### Decision: Start with direct AST emission, add IR only when needed

- **Context:** Compilers often parse into an AST, lower into an intermediate representation (IR), then emit code. That is robust but adds up-front complexity.
- **Options considered:** Direct AST-to-C++; AST -> typed mission IR -> C++; AST -> C++ string templates.
- **Decision:** Use direct AST-to-C++ emission for the MVP while documenting where a mission IR should fit later.
- **Rationale:** The first supported subset is small. Direct emission gets real examples compiling quickly and reveals the actual lowering pressure points.
- **Consequences:** Semantic checks are currently distributed through the emitter. As the subset grows, we should add a dedicated validation/IR pass.
- **Status:** accepted for MVP; revisit before Phase 4/5.

### Decision: Erase `await` in generated C++ for satellite API calls

- **Context:** The JS API examples use `await` for asynchronous-looking resource calls, but C++ firmware may expose synchronous registration/driver APIs or scheduler-owned async behavior.
- **Options considered:** Generate C++20 coroutines; erase `await`; map every call to futures/promises.
- **Decision:** Erase `await` for the current subset and let the runtime API own blocking/asynchronous behavior.
- **Rationale:** This produces simple auditable C++ and matches the examples where `await` primarily expresses sequencing.
- **Consequences:** If the flight runtime needs true coroutine behavior, this decision must be revisited and represented in the runtime contract.
- **Status:** accepted for MVP.

### Decision: Emit `auto` locals for JS `const`

- **Context:** JavaScript `const` prevents rebinding but does not make referenced objects immutable. C++ `const auto` would make bus handles const and break lifecycle calls.
- **Options considered:** Emit `const auto`; emit `auto`; infer constness per expression category.
- **Decision:** Emit `auto` for local variable declarations in the MVP.
- **Rationale:** Resource handles must call methods like `close()`. Binding immutability can be enforced later by analysis if needed.
- **Consequences:** Generated C++ is slightly less restrictive than JS binding semantics, but preserves operational behavior.
- **Status:** accepted for MVP.

### Decision: Use a compile-only C++ runtime shim

- **Context:** We need to verify that generated C++ is syntactically valid before a real flight runtime exists.
- **Options considered:** No runtime header; full runtime implementation; minimal compile-only shim.
- **Decision:** Add `runtime/satellite_os.hpp` as a no-op compile-only shim.
- **Rationale:** It allows tests to compile generated C++ and catches C++-level lowering mistakes early.
- **Consequences:** The shim must be clearly documented as non-flight code so no one mistakes no-op behavior for implementation.
- **Status:** accepted.

## Implementation Phases

The task file (`tasks.md`) is the operational checklist. This section explains the phases conceptually.

### Phase 0: Ticket setup, research, and design

Goal: create the docmgr workspace, capture source/research materials, and write this guide.

Deliverables:

- Ticket workspace under `ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/`.
- Downloaded parser/AST references under `source/research/`.
- Detailed design guide and diary.
- reMarkable bundle upload.

### Phase 1: MVP compiler skeleton

Goal: make one realistic mission script transpile and compile.

Deliverables:

- Node package with `@babel/parser`.
- CLI and public `transpile()` API.
- Recursive C++ emitter.
- Compile-only runtime shim.
- Example script and tests.

Validation:

```bash
npm test
npm run transpile:example
c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o
```

### Phase 2: Explicit semantic validation

Goal: move mission rules out of ad-hoc emitter errors into a validation pass.

Status: implemented in `src/validator.js` with regression coverage in `test/transpile.test.js`.

Implemented checks:

- Only allowed import sources.
- Only allowed global side effects.
- No `console.*`, timers, `eval`, dynamic import, or filesystem APIs.
- All top-level task callbacks are named or directly inspectable lambdas.
- `device.register` driver argument resolves to a relative imported driver type.
- Resource handles opened in a block are closed or deliberately transferred.

Pseudocode:

```text
validate(program):
  imports = collectImports(program)
  rejectUnsupportedImports(imports)
  for statement in program.body:
    if isTopLevelBootStatement(statement):
      validateBootStatement(statement)
    else if isFunctionDeclaration(statement):
      validateFunction(statement)
    else:
      error("top-level statement is not boot wiring")
```

The remaining validation follow-up is resource lifecycle analysis, which is tracked separately as Phase 5 because it requires control-flow reasoning.

### Phase 3: Mission IR

Goal: introduce a typed intermediate representation for satellite concepts.

Why an IR helps:

- It separates JavaScript parsing from mission semantics.
- It makes generated C++ independent from Babel AST quirks.
- It allows a future second backend, such as documentation output or static schedules.

Possible IR sketch:

```ts
type MissionProgram = {
  includes: Include[]
  functions: MissionFunction[]
  boot: BootOperation[]
}

type BootOperation =
  | { kind: 'RegisterDevice', name: string, driverType: string, options: ValueExpr }
  | { kind: 'RegisterFaultHandler', faultName: string, callback: CallbackRef }
  | { kind: 'RegisterTask', mode: 'once' | 'every' | 'on', name: string, period?: string, callback: CallbackRef }
  | { kind: 'StartScheduler' }
```

### Phase 4: Better type/value model

Goal: stop treating every object as `satellite::Object` and every array as `satellite::Array` when stronger types are known.

Work items:

- Define a value schema for mission literals.
- Decide when to emit `std::vector<double>` vs `satellite::Array`.
- Decide how telemetry arrays and bus bytes differ.
- Support mission structs for driver options if manifests provide schemas.

### Phase 5: Runtime integration

Goal: replace the compile-only shim with real runtime headers or adapters.

Work items:

- Align generated includes with the real firmware source tree.
- Define real `satellite::Error` fields and exception/error policy.
- Implement bus/device/task/telemetry/fault calls or bind to existing code.
- Add integration tests that compile and link against runtime libraries.

### Phase 6: Developer experience

Goal: make the transpiler usable by script authors.

Work items:

- Rich diagnostics with source snippets.
- `--check` mode for validation without output.
- `--dump-ast` and later `--dump-ir` for debugging.
- Generated-code formatting options.
- Source maps or line comments linking C++ back to JS.

### Phase 7: Hardening and release

Goal: make the tool trustworthy for repeated mission-script generation.

Work items:

- Golden tests for every supported lowering rule.
- Negative tests for every forbidden feature.
- C++ compile tests in CI.
- Fuzz/snapshot tests for unsupported AST nodes.
- Documentation examples for script authors.

## Code Review Checklist

Reviewers should start here when evaluating changes.

1. **Source contract preservation:** Does the change match `source/satellite-js.md`, or does it add behavior outside the contract?
2. **Diagnostics:** Does unsupported syntax fail with a helpful `TranspileError`?
3. **Determinism:** Does generated C++ avoid hidden dynamic behavior?
4. **Generated C++ readability:** Would a flight engineer understand the output without reading the transpiler source?
5. **Tests:** Is there at least one positive test and one negative test for new syntax or API behavior?
6. **Compile validation:** Does a representative generated file compile with `c++ -std=c++20 -Iruntime -Iexamples`?
7. **Docs/tasks/diary:** Does this ticket explain the change and record failures or tricky semantics?

## Current Validation Results

The following commands pass at the time of this document update:

```bash
npm test
npm run transpile:example
c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o
```

Observed important failure during development:

- Emitting JS `const` as C++ `const auto` prevented calls like `i2c.transact(...)` and `i2c.close()` because the handle became const. The emitter now emits mutable `auto` locals.
- Emitting numeric literal raw text preserved `400_000`, which C++ interpreted as an invalid user-defined literal suffix. The emitter now removes JavaScript numeric separators.
- Passing an abbreviated function template directly to `fault.handle` failed C++ template deduction. Identifier callbacks are now wrapped in generic lambdas.

## Open Questions and Risks

1. **Real runtime API shape:** The shim compiles generated code but does not implement flight behavior. The real runtime may prefer error-code returns over exceptions or different object/value representations.
2. **Type safety:** `satellite::Object` is flexible but weak. Driver options and telemetry values may need schema-driven types.
3. **Async semantics:** Erasing `await` is appropriate for the MVP, but a real asynchronous C++ runtime may require coroutines or scheduler-specific task bodies.
4. **Resource cleanup:** The API says resources release on close or task death. The transpiler should eventually detect obvious missing `close()`/`release()` calls.
5. **Top-level policy:** The MVP accepts broad top-level statements and places them in `satellite_main()`. A stricter validation phase should accept only boot wiring and constant declarations.
6. **Function signatures:** Generic `auto&&` parameters are convenient for MVP output but may be too loose for flight code. A typed IR can produce `satellite::task::Context&` or `satellite::fault::Context&` where known.

## References

### Source contract

- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:5-8` — resource/lifecycle philosophy.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:11-23` — core namespace exports.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:27-50` — `bus` API and atomic transaction decisions.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:54-76` — `device` driver registry.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:80-107` — `task` scheduler API.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:111-134` — `telemetry` API.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:138-161` — `fault` API.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:165-177` — structured error contract.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:181-189` — explicit kernel non-goals.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/satellite-js.md:193-215` — boot sequence sketch.

### Implementation files

- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/src/cli.js` — CLI argument parsing and file I/O.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/src/index.js` — public `transpile()` API.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/src/parser.js` — Babel parse configuration.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/src/validator.js` — mission-script subset validation and stable diagnostics.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/src/emitter.js` — AST-to-C++ lowering.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/src/cpp-writer.js` — generated text indentation helper.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/src/diagnostics.js` — diagnostic/error handling.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/src/satellite-api.js` — known satellite namespaces and include-path helpers.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/runtime/satellite_os.hpp` — compile-only runtime shim.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/examples/housekeeping.js` — example input.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/test/transpile.test.js` — regression tests.

### Research files

- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/research/babel-parser.md` — Babel parser API/options.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/research/babel-traverse.md` — Babel visitor pattern reference.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/research/babel-types.md` — Babel node shape reference.
- `/home/manuel/code/wesen/2026-06-14--satellite-codegen/source/research/esprima-syntax-tree-format.md` — ESTree syntax tree mental model.

## Phase 3-8 Completion Addendum

After the initial Phase 1 MVP and Phase 2 validation pass, the implementation continued through the remaining ticket phases. This addendum is intentionally short because the detailed phase plan above remains the conceptual guide; it records what is now actually present in the repository.

### Completed implementation areas

- **Phase 3 mission IR:** `src/ir.js` builds a `MissionProgram` representation for imports, functions, constants, and boot operations. The C++ emitter now emits boot wiring from IR operations such as `RegisterDevice`, `RegisterTask`, `RegisterFaultHandler`, and `StartScheduler`.
- **Phase 4 value model:** `src/value-model.js` classifies mission values and normalizes numeric literals; `src/schemas.js` validates driver options and telemetry values.
- **Phase 5 resource lifecycle analysis:** `src/resource-analysis.js` catches obvious bus/device handle leaks, conditional-only cleanup, deliberate transfer/return cases, and same-bus interleaving.
- **Phase 6 runtime integration:** `runtime/README.md`, `examples/runner.cpp`, `npm run compile:example`, and `.github/workflows/ci.yml` document and validate compile/link integration against the runtime shim.
- **Phase 7 developer experience:** `src/cli.js` supports `--check`, `--dump-ast`, `--dump-ir`, `--source-comments`, and source-snippet diagnostics. `README.md`, `docs/supported-subset.md`, and `docs/release-checklist.md` provide user-facing docs.
- **Phase 8 hardening:** `test/hardening.test.js` adds golden output coverage, unsupported-AST diagnostics, and performance smoke testing.
- **Makefile support:** `Makefile` provides `make test`, `make check`, `make transpile-example`, `make compile-example`, `make run-example`, `make smoke`, `make dump-ir`, `make dump-ast`, `make docs`, and `make clean`.

### Current validation commands

The final handoff validation is:

```bash
make clean
make compile-example
make smoke
docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30
```

At completion, these commands pass and the generated C++ compiles and links into `build/housekeeping`.
