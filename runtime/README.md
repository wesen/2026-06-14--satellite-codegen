# Satellite C++ Runtime Integration Notes

`runtime/satellite_os.hpp` is the C++ contract that generated `satjs-cpp` output currently targets.

## What this runtime directory is

- A compile/link shim for generated-code tests.
- A concrete header shape for the `satellite::bus`, `satellite::device`, `satellite::task`, `satellite::telemetry`, and `satellite::fault` namespaces.
- A placeholder for adapter work when the real flight runtime becomes available.

## What this runtime directory is not

- It is not a flight-ready runtime.
- It does not perform real bus locking, scheduling, telemetry buffering, or fault handling.
- It should not be used as evidence that generated mission behavior is flight-qualified.

## Error policy decision for the transpiler

The JavaScript API contract says async calls reject with structured errors containing `code`, `source`, `task`, and `ts`. The MVP C++ contract represents that with `satellite::Error`, an exception type with the same fields.

That decision is intentionally isolated in this runtime contract. If the real runtime prefers `std::expected`, status returns, or scheduler-managed failures, update this adapter layer and the emitter together.

## Link smoke test

The repository validates generated C++ with:

```bash
npm run compile:example
```

That command generates `build/housekeeping.cpp`, compiles it with `runtime/satellite_os.hpp`, links it with `examples/runner.cpp`, and produces `build/housekeeping`.
