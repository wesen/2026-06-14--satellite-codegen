# Satellite C++ Emulator Runtime

`runtime/satellite_os.hpp` is the C++ contract that generated `satjs-cpp` output currently targets. It started as a compile-only shim and now behaves as a deterministic emulator for local validation.

## What this runtime directory is

- An executable emulator for generated mission C++.
- A concrete header shape for the `satellite::bus`, `satellite::device`, `satellite::task`, `satellite::telemetry`, and `satellite::fault` namespaces.
- A validation harness for bus locks, device acquisition, scheduler iterations, command events, telemetry frames, telemetry watchers, fault handlers, and cleanup reports.
- A placeholder for adapter work when the real flight runtime becomes available.

## What this runtime directory is not

- It is not a flight-ready runtime.
- It does not perform real hardware access, real-time scheduling, persistent telemetry buffering, or flight-qualified fault handling.
- It should not be used as evidence that generated mission behavior is flight-qualified.

## Error policy decision for the transpiler

The JavaScript API contract says async calls reject with structured errors containing `code`, `source`, `task`, and `ts`. The local C++ contract represents that with `satellite::Error`, an exception type with the same fields.

That decision is intentionally isolated in this runtime contract. If the real runtime prefers `std::expected`, status returns, or scheduler-managed failures, update this adapter layer and the emitter together.

## Emulator conditions

`examples/demo_runner.cpp` calls:

```cpp
satellite::emulator::configure_from_argv(argc, argv);
satellite_main();
satellite::emulator::report();
```

The demo name selects deterministic simulated conditions:

- `fault` demos inject one bus timeout.
- `thermal` and `realistic` demos use an over-temperature panel reading.
- `command` and `realistic` demos enqueue a `cmd:reboot` event.
- `realistic` demos run more scheduler iterations and emulate low EPS voltage.

Set `SATELLITE_EMU_ITERATIONS=N` to override recurring scheduler iterations.

## Validation commands

```bash
make compile-example
make demos-validate
make smoke
```

`make smoke` runs the JavaScript tests, compiles/links the baseline example, validates it, and then checks/transpiles/compiles/runs every demo.
