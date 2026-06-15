---
Title: Satellite JS to C++ Transpiler
Ticket: SATELLITE-JS-CPP-TRANSPILER
Status: active
Topics:
    - transpiler
    - codegen
    - satellite-js
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Ticket workspace for designing and implementing a JS-to-C++ transpiler for the satellite-os API contract."
LastUpdated: 2026-06-15T02:45:00-04:00
WhatFor: "Track research, implementation, validation, and delivery for the satellite JS to C++ transpiler."
WhenToUse: "Use when resuming work on SATELLITE-JS-CPP-TRANSPILER or reviewing its design/tasks/diary."
---

# Satellite JS to C++ Transpiler

## Overview

This ticket designs and implements `satjs-cpp`, a focused transpiler that accepts deterministic JavaScript mission scripts using the `satellite-os` API contract in `source/satellite-js.md` and emits auditable C++ that calls a matching `satellite::...` runtime API.

The work has two tracks:

1. **Documentation and design:** an intern-oriented design/implementation guide, task plan, diary, and reMarkable upload.
2. **Implementation:** a Node/Babel-based parser and C++ emitter with tests, examples, and compile smoke validation.

## Key Links

- Design guide: [design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md](./design-doc/01-satellite-js-to-c-transpiler-design-and-implementation-guide.md)
- Diary: [reference/01-diary.md](./reference/01-diary.md)
- Tasks: [tasks.md](./tasks.md)
- Changelog: [changelog.md](./changelog.md)
- Source contract: [`source/satellite-js.md`](../../../../../source/satellite-js.md)

## Current Status

Phase 0 design work is complete except for reMarkable upload. Phase 1 MVP code is implemented and validates with:

```bash
npm test
npm run transpile:example
c++ -std=c++20 -Iruntime -Iexamples -c build/housekeeping.cpp -o build/housekeeping.o
```

The next major implementation step is Phase 2: extract explicit semantic validation from emitter-only checks into a dedicated validation pass.

## Topics

- transpiler
- codegen
- satellite-js

## Structure

- `design-doc/` — architecture and implementation guide.
- `reference/` — diary and reusable context.
- `scripts/` — ticket-local experiments, if needed later.
- `sources/` — ticket-local source snapshots, if needed later.
- `various/` — working notes.
- `archive/` — deprecated or reference-only artifacts.
