# Release Checklist

Use this checklist before publishing or handing off `satjs-cpp`.

1. Run `npm ci` from a clean checkout.
2. Run `make smoke`.
3. Optionally rerun the equivalent npm commands: `npm test`, `npm run compile:example`, `npm run check:example`, and `npm run validate:demos`.
4. Review generated `build/housekeeping.cpp` and `build/demos/*.cpp` for readability.
5. Run `make run-example` and `make demos-run` if the examples should execute locally as part of the handoff.
6. Confirm `docs/supported-subset.md` matches current validator behavior.
7. Confirm `docs/demo-programs.md` and `docs/emulator.md` match the current demo ladder and emulator behavior.
8. Confirm `runtime/README.md` still states whether the runtime is an emulator, shim, or real adapter.
9. Update the docmgr diary and changelog.
10. Tag/release only after CI is green.
