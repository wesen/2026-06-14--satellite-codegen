---
Title: Diary
Ticket: SATELLITE-JS-CPP-TRANSPILER
Status: active
Topics:
    - transpiler
    - codegen
    - satellite-js
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: Makefile
      Note: |-
        Final requested example compile/run workflow
        Demo validation workflow
    - Path: README.md
      Note: Final README requested by user
    - Path: docs/emulator.md
      Note: Emulator documentation
    - Path: docs/release-checklist.md
      Note: Release/handoff documentation
    - Path: docs/supported-subset.md
      Note: Script-author documentation
    - Path: examples/demos/01-boot-telemetry.js
      Note: First easy demo in the ladder
    - Path: examples/demos/07-realistic-mission-loop.js
      Note: Hardest realistic demo in the ladder
    - Path: runtime/satellite_os.hpp
      Note: |-
        Compile smoke target and runtime-shape assumptions recorded in Step 2
        Emulator implementation details recorded in Step 7
    - Path: src/emitter.js
      Note: Phase 1 implementation and tricky lowering fixes recorded in Step 2
    - Path: test/hardening.test.js
      Note: Phase 8 hardening validation
    - Path: ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md
      Note: Step 1 design deliverable
    - Path: ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/tasks.md
      Note: Phased task plan updated as implementation proceeds
ExternalSources: []
Summary: Chronological implementation diary for the satellite JS to C++ transpiler ticket.
LastUpdated: 2026-06-15T02:55:00-04:00
WhatFor: Record what changed, why, what failed, what was tricky, and how to validate or continue the transpiler work.
WhenToUse: Read before resuming SATELLITE-JS-CPP-TRANSPILER implementation or reviewing its design/code changes.
---




# Diary

## Goal

This diary records the creation of the `SATELLITE-JS-CPP-TRANSPILER` docmgr ticket, the design/research package, the reMarkable delivery work, and the task-by-task implementation of the JavaScript-to-C++ transpiler for the `satellite-os` API contract.

## Step 1: Take Over, Create the Ticket, Gather Evidence, and Write the Intern Guide

The first step was to recover from the incomplete initial handoff, create a proper docmgr ticket, gather source-backed evidence, and write the long-form design guide before continuing deeper implementation. The goal was not merely to create placeholder docs; it was to produce an intern-readable technical map of the source API, compiler pipeline, generated C++ runtime shape, phases, risks, and validation strategy.

This step established the ticket workspace and the source material that future implementation work should use as the ground truth. The key decision was to treat `source/satellite-js.md` as the contract and to store parser/AST research under `source/research/` so the design document has durable local references.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket to create a transpiler that takes JS scripts using the @source/satellite-js.md API, and transpiles them to C++.

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

Then add detailed tasks and phases, and implement it task by task, committing at appropriate intervals, keeping a diary."

**Follow-up user prompt (verbatim):** "we took over from your little brother, right. They didn't do anything. SO now you get to think really really hard. You can also use web search, and use defuddle to download interesting resources and store them in the source/ directory. You can also write scripts in the scripts/ directory to do experiments."

**Assistant interpretation:** Create a real docmgr ticket, do evidence-first research and design, write a detailed intern-oriented guide, upload it to reMarkable, then proceed with implementation in phases while committing and recording diary entries.

**Inferred user intent:** The user wants a serious, durable engineering package and implementation trail, not a shallow placeholder or unreviewable code dump.

**Commit (code):** N/A — this step is documentation/research setup; the first code commit is recorded in Step 2.

### What I did

- Created docmgr ticket `SATELLITE-JS-CPP-TRANSPILER`.
- Created design document `ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md`.
- Created diary document `ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/reference/01-diary.md`.
- Read `source/satellite-js.md` and captured line-referenced evidence with:
  - `nl -ba source/satellite-js.md | sed -n '1,220p'`
- Used Kagi web search for parser/AST/codegen references.
- Used Defuddle to store local research material:
  - `source/research/babel-parser.md`
  - `source/research/babel-traverse.md`
  - `source/research/babel-types.md`
  - `source/research/esprima-syntax-tree-format.md`
- Wrote the detailed design guide with:
  - system maps,
  - source API explanations,
  - pipeline diagrams,
  - lowering tables,
  - pseudocode,
  - runtime shape,
  - decision records,
  - implementation phases,
  - validation commands,
  - risks and open questions.
- Wrote a detailed phased task list in `tasks.md`.
- Updated `index.md` to summarize current status and link key docs.

### Why

- The source API is a small contract, so the transpiler should be designed around that contract rather than around arbitrary JavaScript.
- A new intern needs conceptual orientation before touching compiler code: what an AST is, why Babel is used, what the generated runtime expects, and what semantics are intentionally forbidden.
- Local copies of research sources make the ticket resilient if web content changes or future agents need offline context.

### What worked

- `docmgr ticket create-ticket` and `docmgr doc add` produced the ticket workspace and docs.
- Defuddle successfully downloaded and wrapped the parser/AST references.
- `source/satellite-js.md` is compact enough to line-reference directly in the design guide.
- The design guide now gives a clear path from source API contract to compiler stages and implementation phases.

### What didn't work

- The previous handoff had only created placeholder docs and did not contain a usable guide, tasks, implementation diary, or upload evidence.
- No ticket-local experiment scripts were needed in this step because the MVP implementation could be validated directly through tests and a compile smoke command.

### What I learned

- The `satellite-os` API intentionally excludes broad runtime features such as timers, console logging, arbitrary filesystem access, and mission-specific crypto/uplink framing. The transpiler should enforce those boundaries.
- Babel parser is a good MVP parser because it supports module imports, top-level await, numeric separators, and source locations.
- The eventual system should likely grow a mission IR, but direct AST-to-C++ emission is sufficient to prove the first lowering rules.

### What was tricky to build

- The hard part was keeping the design narrow enough to be implementable while detailed enough for an intern. A general JS-to-C++ compiler would be misleading and unsafe here, so the guide repeatedly ties decisions back to `source/satellite-js.md`.
- Another tricky point was choosing how much web research to pull in. The useful durable sources were parser and AST references, not broad blog posts, because implementation work depends on concrete AST node shapes and parse options.

### What warrants a second pair of eyes

- The supported-subset boundary should be reviewed by someone familiar with expected mission scripts.
- The decision to erase `await` in generated C++ is pragmatic for MVP work, but should be checked against the intended flight runtime scheduling/error model.
- The runtime value representation described in the guide is intentionally flexible and may need a stricter schema before flight use.

### What should be done in the future

- Upload the design bundle to reMarkable after docmgr validation.
- Add a dedicated semantic validation pass so mission safety rules are not scattered through emitter special cases.
- Add a mission IR before the lowering matrix grows too large.

### Code review instructions

- Start with the design guide:
  - `ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md`
- Check source contract references in:
  - `source/satellite-js.md`
- Validate doc health with:
  - `docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30`

### Technical details

Commands used:

```bash
docmgr ticket create-ticket --ticket SATELLITE-JS-CPP-TRANSPILER --title "Satellite JS to C++ Transpiler" --topics transpiler,codegen,satellite-js
docmgr doc add --ticket SATELLITE-JS-CPP-TRANSPILER --doc-type design-doc --title "Satellite JS to C++ Transpiler Design and Implementation Guide"
docmgr doc add --ticket SATELLITE-JS-CPP-TRANSPILER --doc-type reference --title "Diary"
nl -ba source/satellite-js.md | sed -n '1,220p'
defuddle parse https://babeljs.io/docs/babel-parser --md | fold -w 100 -s > source/research/babel-parser.md
defuddle parse https://babeljs.io/docs/babel-traverse --md | fold -w 100 -s > source/research/babel-traverse.md
defuddle parse https://babeljs.io/docs/babel-types --md | fold -w 100 -s > source/research/babel-types.md
defuddle parse https://esprima.readthedocs.io/en/latest/syntax-tree-format.html --md | fold -w 100 -s > source/research/esprima-syntax-tree-format.md
```

## Step 2: Implement and Validate the Phase 1 MVP Transpiler

The second step implemented a working MVP instead of stopping at design. It created a Node/Babel-based compiler skeleton, direct AST-to-C++ emitter, command-line interface, compile-only C++ runtime shim, example mission script, and tests. The result is not yet a full compiler, but it is now a working vertical slice: JavaScript input goes through the CLI, produces generated C++, and that C++ compiles against a shim runtime.

This step also uncovered several semantic mismatches between JavaScript and C++. Those failures are important because they shaped the current lowering rules: JS numeric separators are not C++ numeric separators, JS `const` is not C++ object constness, and C++ cannot always pass an abbreviated function template directly as a callback value.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Follow-up user prompt (verbatim):** "Don't forget to Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable."

**Additional user prompt (verbatim):** "then continue with the transpiler"

**Assistant interpretation:** After ensuring the detailed guide exists and is tracked, continue the actual transpiler implementation in task-sized chunks and commit the code.

**Inferred user intent:** The user wants both the durable design artifact and real forward implementation progress, with validation and commits rather than just planning.

**Commit (code):** `1a427f8af05ceb62abcf22733de9d0de7edee429` — "Implement MVP satellite JS to C++ transpiler"

### What I did

- Added package metadata and dependency pinning:
  - `package.json`
  - `package-lock.json`
- Added `.gitignore` for `node_modules/`, `build/`, logs, and `.DS_Store`.
- Implemented parser wrapper:
  - `src/parser.js`
- Implemented public API:
  - `src/index.js`
- Implemented diagnostics:
  - `src/diagnostics.js`
- Implemented deterministic C++ writer:
  - `src/cpp-writer.js`
- Implemented satellite API helper definitions:
  - `src/satellite-api.js`
- Implemented the main AST-to-C++ emitter:
  - `src/emitter.js`
- Implemented CLI:
  - `src/cli.js`
- Added compile-only runtime shim:
  - `runtime/satellite_os.hpp`
- Added example input and driver declaration:
  - `examples/housekeeping.js`
  - `examples/drivers/eps.hpp`
- Added tests:
  - `test/transpile.test.js`
- Validated the implementation with:
  - `npm test`
  - `npm run transpile:example`
  - `c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o`
- Committed the Phase 1 implementation as `1a427f8`.

### Why

- A vertical slice is the fastest way to expose real lowering problems.
- Tests ensure the design guide stays connected to executable behavior.
- The compile-only runtime shim catches generated C++ syntax/type mistakes before a real runtime exists.
- The CLI makes the tool usable immediately for examples and future integration tests.

### What worked

- `npm install` installed `@babel/parser` successfully.
- `npm test` passes with four Node tests:
  - core satellite import/task/bus/telemetry lowering,
  - `device.register` typed driver lowering,
  - unsupported import diagnostics,
  - CLI `--out` file generation.
- `npm run transpile:example` generates `build/housekeeping.cpp` from `examples/housekeeping.js`.
- The generated C++ compiles with:
  - `c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o`

### What didn't work

Initial compile smoke validation exposed three concrete C++ issues.

First, JS `const` was emitted as C++ `const auto`, which made resource handles immutable:

```text
build/housekeeping.cpp: In lambda function:
... error: passing ‘const satellite::bus::Handle’ as ‘this’ argument discards qualifiers
```

The fix was to emit `auto` for local variable declarations because JavaScript `const` freezes the binding, not the referenced object.

Second, the emitter preserved the JavaScript numeric separator in `400_000`, which C++ parsed as an invalid user-defined literal suffix:

```text
build/housekeeping.cpp:29:75: error: unable to find numeric literal operator ‘operator""_000’
   29 |     auto i2c = satellite::bus::open("i2c0", satellite::Object{{"clockHz", 400_000}});
      |                                                                           ^~~~~~~
```

The fix was to remove `_` from Babel numeric literal raw text before emission.

Third, passing a generated abbreviated function template directly to `fault.handle` failed template deduction:

```text
build/housekeeping.cpp:23:27: error: no matching function for call to ‘handle(const char [17], <unresolved overloaded function type>)’
   23 |   satellite::fault::handle("EPS_UNDERVOLTAGE", epsUndervoltageHandler);
      |   ~~~~~~~~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

The fix was to wrap identifier callbacks in generic lambdas:

```cpp
satellite::fault::handle("EPS_UNDERVOLTAGE", [&](auto&&... args) { return epsUndervoltageHandler(args...); });
```

### What I learned

- A generated C++ compile smoke test is essential even when JavaScript tests pass.
- The source language's surface syntax can look simple while hiding target-language semantic mismatches.
- The MVP emitter can be direct, but validation should move to a separate pass soon so unsupported behavior is rejected before emission.
- A no-op C++ shim is enough to catch many target-language mistakes and should remain part of the test strategy.

### What was tricky to build

- The biggest tricky part was callback lowering. Named JavaScript functions with parameters emitted naturally as `auto fn(auto&& ctx)`, but that C++ form is an abbreviated function template. Passing it directly as a callback value can fail. The generic-lambda wrapper is slightly verbose but robust.
- The second tricky part was local constness. A naive compiler might preserve `const` by emitting `const auto`, but resource lifecycle methods such as `close()` need a mutable handle object. The design guide now explains this mismatch.
- The third tricky part was keeping object literals flexible enough for bus/device options while still generating compilable C++. The shim's `satellite::Value` variant allows `satellite::Object{{"key", value}}` to compile for current examples.

### What warrants a second pair of eyes

- Review `src/emitter.js` special cases for `device.register`, `task.*`, `fault.handle`, `Uint8Array.of`, and `Date.now` to ensure they match the intended runtime naming.
- Review whether `await` erasure is valid for the eventual runtime.
- Review whether all generated function signatures should remain generic `auto&&` or become typed once a mission IR exists.
- Review the runtime shim to ensure it is clearly non-flight and cannot be mistaken for a real implementation.

### What should be done in the future

- Phase 2 should add a dedicated validation pass and negative tests for forbidden constructs.
- Phase 3 should introduce a mission IR so boot operations are not emitted directly from Babel AST.
- Phase 4 should make value typing stricter, especially for telemetry and driver options.
- Phase 5 should integrate with the real C++ runtime.

### Code review instructions

- Start with `src/emitter.js`:
  - import collection: `collectImports`,
  - top-level partitioning in `emit`,
  - statement/expression dispatch,
  - `emitSatelliteCall`,
  - callback wrapping.
- Then review runtime assumptions in `runtime/satellite_os.hpp`.
- Then review tests in `test/transpile.test.js`.
- Validate locally with:

```bash
npm test
npm run transpile:example
c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o
```

### Technical details

Commands used:

```bash
npm install
npm test
npm run transpile:example
c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o
git add .gitignore package.json package-lock.json src runtime examples test
git commit -m "Implement MVP satellite JS to C++ transpiler"
git rev-parse HEAD
```

## Step 3: Validate the Ticket and Upload the Guide to reMarkable

The third step closed the documentation-delivery loop. After the guide, tasks, diary, relations, and changelog were in place, I ran docmgr validation, fixed vocabulary warnings, performed a dry-run reMarkable bundle upload, and then uploaded the final bundle.

This step matters because the user explicitly requested that the detailed intern guide be stored in the ticket and uploaded to reMarkable before continuing deeper implementation. The reMarkable bundle includes the design guide, tasks, diary, and original satellite JS API contract.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Complete the documentation delivery workflow, including validation and reMarkable upload, before moving on to additional transpiler phases.

**Inferred user intent:** The user wants a reviewable long-form artifact available outside the repository, not just local markdown files.

**Commit (code):** N/A — this step changed ticket documentation and delivery status only.

### What I did

- Related key implementation and source files to the design guide with `docmgr doc relate`.
- Related the design guide, tasks, emitter, and runtime shim to the diary.
- Updated the changelog with the design and Phase 1 implementation summary.
- Ran `docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30`.
- Added missing vocabulary slugs:
  - `codegen`
  - `satellite-js`
  - `transpiler`
- Re-ran `docmgr doctor`, which passed.
- Performed a dry-run upload of the bundle.
- Uploaded the bundle to reMarkable.
- Marked the reMarkable upload task complete.

### Why

- Docmgr validation catches stale metadata and vocabulary issues before handoff.
- The dry-run confirmed the bundle inputs, name, and remote path before invoking pandoc/upload.
- Marking the task complete keeps the ticket task list aligned with actual delivery.

### What worked

- `docmgr doctor` passed after adding the missing vocabulary entries.
- The reMarkable dry-run showed the expected bundle files and destination.
- The real upload succeeded with:

```text
OK: uploaded SATELLITE JS CPP Transpiler Guide.pdf -> /ai/2026/06/14/SATELLITE-JS-CPP-TRANSPILER
```

### What didn't work

- The first `docmgr doctor` run reported unknown topic vocabulary values:

```text
unknown topics: [codegen satellite-js transpiler]
```

- This was fixed by adding the three topic slugs with `docmgr vocab add` and rerunning doctor.

### What I learned

- New ticket topics should be added to vocabulary early when creating a fresh docmgr workspace.
- The reMarkable bundle command can include both ticket docs and source markdown, which is useful here because `source/satellite-js.md` is the API contract the guide explains.

### What was tricky to build

- The only tricky part was reconciling upload workflow expectations. The safe path was to run a dry-run first, then run the real bundle upload, while avoiding unnecessary status/list calls.
- Another small issue was making sure the bundle name was simple enough for upload tooling: `SATELLITE JS CPP Transpiler Guide`.

### What warrants a second pair of eyes

- Confirm the uploaded bundle content is the right set of files for the intended reader: design guide, tasks, diary, and source API contract.
- Check whether future uploads should include generated C++ examples or source code PDFs as separate bundles.

### What should be done in the future

- If the design guide changes substantially after Phase 2 or Phase 3, upload a refreshed bundle or a follow-up report.
- Add README-level documentation for script authors once validation and IR work stabilize.

### Code review instructions

- Review doc changes in:
  - `ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md`
  - `ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/tasks.md`
  - `ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/reference/01-diary.md`
  - `ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/changelog.md`
- Validate with:

```bash
docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30
```

### Technical details

Commands used:

```bash
docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30
docmgr vocab add --category topics --slug codegen --description "Code generation tools, emitted code, and generated-code workflows"
docmgr vocab add --category topics --slug satellite-js --description "Satellite onboard JavaScript API and mission-script tooling"
docmgr vocab add --category topics --slug transpiler --description "Source-to-source compiler and transpilation work"
docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30
remarquee upload bundle --dry-run \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/tasks.md \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/reference/01-diary.md \
  source/satellite-js.md \
  --name "SATELLITE JS CPP Transpiler Guide" \
  --remote-dir "/ai/2026/06/14/SATELLITE-JS-CPP-TRANSPILER" \
  --toc-depth 2 \
  --non-interactive
remarquee upload bundle \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/tasks.md \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/reference/01-diary.md \
  source/satellite-js.md \
  --name "SATELLITE JS CPP Transpiler Guide" \
  --remote-dir "/ai/2026/06/14/SATELLITE-JS-CPP-TRANSPILER" \
  --toc-depth 2 \
  --non-interactive
```

## Step 4: Backfill Phase 2 Through Phase 8 Implementation

This step records the rapid continuation from the Phase 1 MVP through the remaining implementation phases. The work converted the transpiler from a direct parser/emitter prototype into a more complete toolchain: semantic validation, mission IR, value-model checks, resource lifecycle analysis, runtime compile/link smoke integration, CLI developer tooling, user docs, and hardening tests.

The important pattern was to keep each phase narrow. Validation rejects mission-policy violations before C++ emission, IR isolates boot wiring from Babel AST details, value/schema checks enforce API contracts, resource analysis catches obvious leaks, and the Makefile/CI/docs make the project reviewable and repeatable.

### Prompt Context

**User prompt (verbatim):** "continue all the way through to phase 8, i'm making dinner in the meantime and want you to be done fully"

**Follow-up user prompt (verbatim):** "continue keeping a detailed diary as you work. don't forget, and backfill if necessary."

**Additional user prompt (verbatim):** "write a nice README.md if you haven't and some docs as well."

**Assistant interpretation:** Finish the entire phased implementation plan, not just the first vertical slice, and backfill the diary with the actual phase-by-phase work and validation results.

**Inferred user intent:** The user wants to return from dinner to a completed, committed, documented, and validated project rather than a partially implemented compiler.

**Commit (code):** `253cafabcc30fd5a9561317331adfd63d5275a0a` — "Add mission script validation pass"

**Commit (code):** `c76128ec326e928ce101c1541910c6ac896eac15` — "Introduce mission IR lowering"

**Commit (code):** `268b24de8b3d113b87042bd9830796ebd5d238d0` — "Add mission value model validation"

**Commit (code):** `a60482c8adec0620426d52c86865b0df4dfece3e` — "Analyze satellite resource lifecycles"

**Commit (code):** `a567494ab12428f18da5fed0bb7f5c251f32bbd7` — "Add runtime link smoke integration"

**Commit (code):** `6732f1221ed56d401f51aa6ba67fdb6c75ab371f` — "Improve CLI developer experience and docs"

### What I did

- Added `src/validator.js` and wired it through `src/index.js` so validation runs before emission.
- Added stable diagnostics for unsupported imports, forbidden runtime APIs, invalid top-level forms, API arity, callback shape, and relative driver import requirements.
- Added `src/ast-utils.js` and `src/ir.js` so boot wiring lowers into a `MissionProgram` IR.
- Updated `src/emitter.js` to emit boot operations from IR while still emitting supported function/callback body AST directly.
- Added `src/value-model.js` to classify null, booleans, integers, floats, strings, byte arrays, arrays, objects, identifiers, and unknown calls.
- Added `src/schemas.js` to validate driver options and telemetry values.
- Added `src/resource-analysis.js` to detect obvious bus/device resource lifecycle mistakes.
- Added `runtime/README.md`, `examples/runner.cpp`, `npm run compile:example`, `npm run smoke`, and GitHub Actions CI for runtime compile/link smoke coverage.
- Expanded `src/cli.js` with `--check`, `--dump-ast`, `--dump-ir`, and `--source-comments`.
- Improved `src/diagnostics.js` to include source snippets and carets in CLI diagnostics.
- Added `README.md`, `docs/supported-subset.md`, and `docs/release-checklist.md`.
- Added `examples/bad-console.js` for CLI diagnostic testing.
- Added tests covering validation, IR output, CLI tools, docs-facing behavior, and hardening.

### Why

- Phase 2 validation makes unsupported mission code fail before C++ generation.
- Phase 3 IR prevents boot-wiring code generation from depending directly on Babel AST details forever.
- Phase 4 value checks are necessary because the source API explicitly restricts telemetry and bus/driver value shapes.
- Phase 5 lifecycle analysis is needed because the source API is resource-oriented and leaks should be caught before generated code reaches firmware.
- Phase 6 runtime integration ensures generated C++ does not merely look plausible; it compiles and links.
- Phase 7 docs/CLI work makes the project usable by script authors and future maintainers.
- Phase 8 hardening tests reduce regression risk and document expected unsupported-syntax behavior.

### What worked

- The validation pass cleanly catches policy violations with stable diagnostic codes.
- The IR pass successfully represents boot operations and supports JSON dumping.
- The value model and schema checks catch unsafe byte literals, invalid driver option types, telemetry strings, and telemetry object blobs.
- Resource analysis catches missing close/release, conditional-only cleanup, and opening the same bus twice before closing the first handle.
- The runtime shim plus runner can link generated C++ into `build/housekeeping`.
- `npm test`, `npm run smoke`, and later `make smoke` pass.

### What didn't work

- The first hardening test expected only messages matching `/Unsupported|not supported|must/`, but one valid diagnostic said:

```text
Only simple identifier variable declarations are supported in the first implementation.
```

- The fix was to broaden the assertion to a case-insensitive pattern that accepts `supported` as well as `unsupported`, `not supported`, and `must`.
- A large multi-edit attempt to modernize the entire design document failed because one repeated text block was not unique. Rather than risk a destructive rewrite, I added a focused completion addendum and updated relations/changelog.

### What I learned

- Validation, IR, and emission need separate responsibilities even in a small compiler.
- Runtime compile/link smoke testing catches different mistakes than JS tests.
- Conservative resource analysis is useful even when it is not fully path-sensitive or interprocedural.
- Diagnostics tests should assert stable diagnostic codes more strongly than exact prose when prose is intentionally human-friendly.

### What was tricky to build

- Resource lifecycle analysis was the trickiest Phase 5 piece. The implementation had to recognize handles opened by `bus.open` and `device.acquire`, closure through `handle.close()` or `device.release(name)`, deliberate transfer through returns or `transferResource(handle)`, and conditional cleanup that does not cover all paths. The current pass is intentionally conservative and same-function only.
- IR integration was also subtle because function bodies still use direct AST emission. The compromise is that boot wiring is IR-based now, while callback/function body lowering remains direct until a later typed body IR is worth the complexity.
- CLI `--dump-ir` had to validate the source before dumping IR so users do not inspect IR for invalid mission scripts.

### What warrants a second pair of eyes

- Review `src/resource-analysis.js` for false positives and false negatives around conditionals and helper transfers.
- Review `src/schemas.js` telemetry restrictions against real mission telemetry conventions.
- Review `src/ir.js` and `src/emitter.js` together to ensure no boot operation bypasses validation or emits surprising C++.
- Review `runtime/README.md` to make sure future users do not mistake the shim for flight runtime code.

### What should be done in the future

- Replace the shim with the real flight runtime adapter when available.
- Introduce typed function-body IR if generated callback bodies become more complex.
- Add line-source mapping beyond simple `// JS line N` comments if operators need traceability from compiled artifacts back to mission JS.

### Code review instructions

- Review in phase order:
  - `src/validator.js`
  - `src/ir.js`
  - `src/value-model.js`
  - `src/schemas.js`
  - `src/resource-analysis.js`
  - `src/emitter.js`
  - `src/cli.js`
- Then review user-facing docs:
  - `README.md`
  - `docs/supported-subset.md`
  - `docs/release-checklist.md`
  - `runtime/README.md`
- Validate with:

```bash
npm test
npm run smoke
```

### Technical details

Validation commands used during this phase:

```bash
npm test
npm run transpile:example
c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o
npm run compile:example
npm run smoke
```

## Step 5: Add Makefile, Verify C++ Compilation, and Prepare Final Push

This step addressed the final handoff requests: add a Makefile for examples, make sure generated C++ compiles, commit all remaining changes, update the diary before pushing, and push the branch. It also records the final hardening test and documentation updates that were pending after the Phase 8 implementation.

The Makefile is now the easiest local entrypoint for a reviewer. It wraps install/test/check/transpile/compile/run/smoke/debug/doc commands and compiles the generated example with the runtime shim and C++ runner.

### Prompt Context

**User prompt (verbatim):** "commit all the things and push"

**Follow-up user prompt (verbatim):** "add Makefile to run and compile the examples, and make sure the C++ compiles"

**Additional user prompt (verbatim):** "everytim you commit from now on, also push. update the diary before each push"

**Assistant interpretation:** Before pushing, update the diary, add a Makefile that can generate and compile the example, run validation, commit every remaining change, and push all local commits.

**Inferred user intent:** The user wants a clean remote branch containing all work, with a reviewer-friendly Makefile and no uncommitted local state.

**Commit (code):** `9fea320bd75ddc4066c1161774bb3fc9da5dd9ae` — "Add Makefile and hardening handoff docs"

### What I did

- Added `Makefile` with targets:
  - `make install`
  - `make test`
  - `make check`
  - `make transpile-example`
  - `make compile-example`
  - `make run-example`
  - `make smoke`
  - `make dump-ir`
  - `make dump-ast`
  - `make docs`
  - `make clean`
- Updated `README.md` to document Makefile commands.
- Updated `docs/release-checklist.md` to use `make smoke` as the primary release/handoff validation.
- Added `test/hardening.test.js` with golden output, unsupported syntax diagnostics, and performance smoke coverage.
- Updated the design document with a Phase 3-8 completion addendum and final validation commands.
- Updated tasks so all Phase 0-8 items are checked.
- Related final files to the design guide and diary through docmgr.
- Updated the changelog with final completion notes.

### Why

- Make targets give reviewers and future agents a stable command surface independent of npm script details.
- `make compile-example` explicitly proves generated C++ compiles and links.
- Updating the diary before push satisfies the user's workflow requirement and preserves the exact validation evidence.

### What worked

The requested compile path passed:

```bash
make clean
make compile-example
```

The full smoke path passed:

```bash
make smoke
```

The ticket validation passed:

```bash
docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30
```

### What didn't work

- Before the final Makefile work, `test/hardening.test.js` was untracked and one assertion failed because the diagnostic prose used `supported` rather than `unsupported`. That was fixed before final validation.
- The design document still contains some historical MVP phrasing in the main body. Rather than rewrite the entire long document under time pressure, I added an explicit completion addendum that records the final Phase 3-8 state and validation commands.

### What I learned

- Makefile targets are useful even for a Node project when the validation path includes C++ compilation.
- The most important final validation command is `make smoke`, because it exercises JS tests, generated C++ compile/link, and validation-only checking.
- Diary updates are easiest to keep correct if they are done immediately before the final commit/push boundary.

### What was tricky to build

- The final push preparation had to include code, docs, docmgr tasks, changelog, and diary in one coherent state. The ordering matters: update docs/diary, run validation, commit, amend the diary with the final hash if needed, and only then push.
- The generated C++ compile target must depend on generated source, the runner, the runtime shim, and driver headers so `make compile-example` rebuilds when any relevant input changes.

### What warrants a second pair of eyes

- Check `Makefile` target dependencies and whether `CXXFLAGS` should be stricter or mission-specific.
- Review `test/hardening.test.js` golden output expectations when the emitter changes.
- Confirm the final design addendum is sufficient, or decide whether to rewrite the whole guide after handoff.

### What should be done in the future

- Add more example scripts once real mission use cases appear.
- Add per-example Make targets if examples expand beyond housekeeping.
- Re-upload the final post-Phase-8 bundle to reMarkable if the user wants the latest docs there too.

### Code review instructions

- Start with `Makefile`, then run:

```bash
make clean
make compile-example
make smoke
```

- Inspect generated C++:

```bash
sed -n '1,220p' build/housekeeping.cpp
```

- Review hardening tests in `test/hardening.test.js`.
- Review final docs in `README.md`, `docs/supported-subset.md`, `docs/release-checklist.md`, and the design addendum.

### Technical details

Final validation commands run before the final commit/push:

```bash
make clean
make compile-example
make smoke
npm test
npm run smoke
docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30
```

## Step 6: Re-upload Final Post-Phase-8 Bundle to reMarkable

After the final code/docs push, I uploaded a refreshed reMarkable bundle with the post-Phase-8 design addendum, final tasks, diary, README, supported-subset doc, release checklist, and original satellite JS API contract. This avoids leaving the earlier reMarkable upload stale relative to the completed repository.

### Prompt Context

**User prompt (verbatim):** (same as Step 5)

**Assistant interpretation:** Keep the externally delivered documentation aligned with the completed and pushed repository state.

**Inferred user intent:** The user wants the final guide available on reMarkable, not only the earlier pre-Phase-8 guide.

**Commit (code):** N/A — documentation delivery record only.

### What I did
- Uploaded `SATELLITE JS CPP Transpiler Guide Final.pdf` to `/ai/2026/06/14/SATELLITE-JS-CPP-TRANSPILER`.
- Included the design guide, tasks, diary, README, supported-subset doc, release checklist, and source API contract.

### Why
- The guide changed after the first upload, so the final reMarkable copy needed to be refreshed.

### What worked
- Upload succeeded with:

```text
OK: uploaded SATELLITE JS CPP Transpiler Guide Final.pdf -> /ai/2026/06/14/SATELLITE-JS-CPP-TRANSPILER
```

### What didn't work
- N/A

### What I learned
- Use a new final bundle name rather than overwriting the earlier upload when annotations may exist.

### What was tricky to build
- N/A

### What warrants a second pair of eyes
- Confirm whether the earlier non-final bundle should be deleted or left as historical context.

### What should be done in the future
- If more docs change, upload a new dated/final bundle rather than overwriting annotated PDFs.

### Code review instructions
- No code review needed for upload-only work.
- Check the remote path `/ai/2026/06/14/SATELLITE-JS-CPP-TRANSPILER` on reMarkable if manual verification is desired.

### Technical details

```bash
remarquee upload bundle \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/tasks.md \
  ttmp/2026/06/14/SATELLITE-JS-CPP-TRANSPILER--satellite-js-to-c-transpiler/reference/01-diary.md \
  README.md \
  docs/supported-subset.md \
  docs/release-checklist.md \
  source/satellite-js.md \
  --name "SATELLITE JS CPP Transpiler Guide Final" \
  --remote-dir "/ai/2026/06/14/SATELLITE-JS-CPP-TRANSPILER" \
  --toc-depth 2 \
  --non-interactive
```

## Step 7: Add Demo Ladder and Deterministic C++ Emulator Harness

This step expands the project from a compiler and compile-smoke harness into an executable demo environment. The new demo ladder starts with a minimal boot telemetry script and ends with a realistic multi-subsystem mission loop that exercises bus access, device acquisition, scheduler iterations, telemetry watches, command events, fault handling, and recovery behavior.

The most important implementation change is that `runtime/satellite_os.hpp` is no longer just a no-op compile shim. It now implements a deterministic emulator that makes generated C++ run on a developer machine and reports telemetry, faults, scheduler events, resource leaks, and logs. This gives reviewers a way to test the generated C++ under simulated real conditions instead of only checking that it compiles.

### Prompt Context

**User prompt (verbatim):** "make a whole set of demo JS programs from easy to harder, and an emulator environment / library for the C++ so we can test things. Then transpiel them and validate. Extensive and from simple to real life complexity. The emulator harness should simulate real conditions."

**Assistant interpretation:** Add a broad demo suite, implement a realistic-enough C++ emulator for the generated satellite runtime API, transpile/compile/run all demos, validate them, document the workflow, and keep the diary updated before pushing.

**Inferred user intent:** The user wants confidence that the transpiler produces runnable mission-like C++ across a range of complexity, not only one small example.

**Commit (code):** `e32ee61` — ":art: Add examples" (demo/emulator implementation commit already on `origin/main`)

**Commit (code):** `c69b59c52915b82c50b97ee1d6bee31d3554dd91` — "Document emulator demo ladder"

### What I did

- Added seven demo JS programs under `examples/demos/`:
  - `01-boot-telemetry.js`
  - `02-bus-temperature.js`
  - `03-device-heater-control.js`
  - `04-fault-recovery.js`
  - `05-thermal-watchdog.js`
  - `06-command-safe-mode.js`
  - `07-realistic-mission-loop.js`
- Added `examples/demos/README.md` with the demo ladder summary.
- Added `examples/demo_runner.cpp` so each generated demo binary can run `satellite_main()` under the emulator.
- Updated `examples/runner.cpp` so the baseline housekeeping example also runs under the emulator and reports telemetry/logs.
- Added `examples/drivers/adcs.hpp` for the realistic mission demo.
- Replaced the no-op behavior in `runtime/satellite_os.hpp` with a deterministic emulator for:
  - bus locks and transactions,
  - injected bus timeouts,
  - device registration/acquisition/release,
  - output control,
  - once/every/on scheduler registrations,
  - recurring scheduler iterations,
  - command events,
  - telemetry emission and snapshots,
  - telemetry threshold watchers,
  - fault counters and handlers,
  - task pause/shutdown,
  - resource leak reporting.
- Updated `Makefile` with demo targets:
  - `make demos-check`
  - `make demos-transpile`
  - `make demos-compile`
  - `make demos-run`
  - `make demos-validate`
- Updated `make smoke` to include demo validation.
- Added docs:
  - `docs/demo-programs.md`
  - `docs/emulator.md`
- Updated `README.md`, `runtime/README.md`, `docs/release-checklist.md`, and CI to use the new demo/emulator flow.
- Relaxed the mission value model to allow member-reference telemetry values like `ctx.count` and `ctx.iteration`.
- Updated callback lowering so named `task.once` callbacks compile as no-argument wrappers instead of fragile generic varargs wrappers.

### Why

- A single example can hide compiler/runtime integration mistakes. A demo ladder forces the toolchain through increasingly realistic API combinations.
- The emulator makes generated C++ executable and observable without flight hardware.
- Simulated time, faults, telemetry watches, commands, and resource locks provide much stronger validation than compile-only tests.
- Make targets make the workflow easy to repeat in CI and during review.

### What worked

- All demo JS programs pass validation with `make demos-check`.
- All demos transpile to C++ under `build/demos/*.cpp`.
- All generated demo C++ files compile and link with `examples/demo_runner.cpp`.
- All demo binaries execute under the emulator and print telemetry/fault/log reports.
- Full validation passes with:

```bash
make clean
make smoke
make run-example
```

### What didn't work

- The first demo compile exposed a callback-lowering problem. Named no-argument `task.once` callbacks were wrapped as generic varargs lambdas. The emulator's invocability checks tried to instantiate the wrapper with a task context, which produced a hard C++ error for functions like `bootBeacon()` that take no arguments. I fixed this by making IR boot-operation emission choose callback wrapper shape by API: no args for `task.once`, context for `task.every`/fault handlers, and payload for `task.on`.
- Demo validation initially rejected telemetry values like `ctx.count` because the value model did not classify `MemberExpression` as an allowed runtime reference. I added a `reference` value kind so telemetry can emit context fields and similar runtime values while driver schemas still enforce literal types where needed.
- The command demos initially accepted a `payload` parameter they did not use, which produced noisy `-Wall -Wextra` warnings. I changed those demo callbacks to no-argument callbacks because the payload was not needed for the scenario.

### What I learned

- C++ generic-lambda invocability can instantiate callback bodies in ways that turn an apparent SFINAE check into a hard error. API-aware callback wrappers are safer than a single varargs wrapper.
- A realistic emulator quickly reveals assumptions that compile-only shims hide, especially around resource closure, callbacks, and scheduler execution order.
- Demo names are a simple, effective way to configure deterministic emulator conditions without adding a separate scenario file format yet.

### What was tricky to build

- The emulator needed enough behavior to feel real without becoming a second flight runtime. I kept it deterministic and header-only, but it now models the parts that matter for generated code: bus locks, device locks, telemetry frames, watchers, fault callbacks, scheduler iterations, command events, shutdown, and report-based leak detection.
- The hardest compatibility issue was bridging generated callback shapes to runtime invocation. The final design lets the emitter choose callback wrapper shape from the known satellite API call instead of forcing the runtime to guess.
- Include paths for demos required care because demos import drivers with `../drivers/eps.js`, which lowers to `#include "../drivers/eps.hpp"`. The Makefile compiles generated demo C++ with `-Iexamples/demos` so those relative includes resolve correctly.

### What warrants a second pair of eyes

- Review `runtime/satellite_os.hpp` for emulator semantics and whether any behavior should move out of the header if it grows further.
- Review the demo ladder to confirm it covers the right mission scenarios and failure modes.
- Review `src/emitter.js` callback wrapper selection for `task.once`, `task.every`, `task.on`, and `fault.handle`.
- Review whether demo-name-driven emulator scenarios should eventually become explicit YAML/JSON scenario files.

### What should be done in the future

- Add scenario files if demos need richer conditions than demo-name switches and `SATELLITE_EMU_ITERATIONS`.
- Add assertions over emulator output rather than relying only on exit code/log review.
- Add more subsystem-specific driver facades once real mission drivers are known.

### Code review instructions

- Start with the demo ladder:

```bash
ls examples/demos
```

- Review the emulator:

```bash
less runtime/satellite_os.hpp
less docs/emulator.md
```

- Validate everything:

```bash
make clean
make demos-validate
make smoke
make run-example
```

### Technical details

Final validation commands run before this diary update:

```bash
make clean
make demos-check
make demos-compile
make demos-run
make smoke
make run-example
```
