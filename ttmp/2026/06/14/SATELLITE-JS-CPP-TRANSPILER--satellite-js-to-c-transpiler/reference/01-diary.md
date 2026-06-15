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
    - Path: runtime/satellite_os.hpp
      Note: Compile smoke target and runtime-shape assumptions recorded in Step 2
    - Path: src/emitter.js
      Note: Phase 1 implementation and tricky lowering fixes recorded in Step 2
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
