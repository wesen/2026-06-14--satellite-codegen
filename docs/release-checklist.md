# Release Checklist

Use this checklist before publishing or handing off `satjs-cpp`.

1. Run `npm ci` from a clean checkout.
2. Run `npm test`.
3. Run `npm run compile:example`.
4. Run `npm run check:example`.
5. Review generated `build/housekeeping.cpp` for readability.
6. Confirm `docs/supported-subset.md` matches current validator behavior.
7. Confirm `runtime/README.md` still states whether the runtime is a shim or real adapter.
8. Update the docmgr diary and changelog.
9. Tag/release only after CI is green.
