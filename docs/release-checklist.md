# Release Checklist

Use this checklist before publishing or handing off `satjs-cpp`.

1. Run `npm ci` from a clean checkout.
2. Run `make smoke`.
3. Optionally rerun the equivalent npm commands: `npm test`, `npm run compile:example`, and `npm run check:example`.
4. Review generated `build/housekeeping.cpp` for readability.
5. Run `make run-example` if the example should execute locally as part of the handoff.
6. Confirm `docs/supported-subset.md` matches current validator behavior.
7. Confirm `runtime/README.md` still states whether the runtime is a shim or real adapter.
8. Update the docmgr diary and changelog.
9. Tag/release only after CI is green.
