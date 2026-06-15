# C++ Emulator Runtime

The emulator is implemented in `runtime/satellite_os.hpp`. Generated C++ includes `satellite_os.hpp`, so the same transpiled output can be compiled against either this local emulator or a future flight runtime adapter.

## Goals

The emulator is designed to make generated mission C++ executable on a developer machine. It simulates the important contracts from `source/satellite-js.md`:

- bus locking and transaction responses,
- named device registration/acquisition/release,
- task registration and scheduler iterations,
- command events,
- telemetry frame collection,
- telemetry threshold watchers,
- fault counting and recovery handlers,
- basic shutdown/pause behavior,
- runtime reporting of leaked bus/device resources.

It is not flight software. It is a deterministic validation harness for generated code.

## Runner

`examples/demo_runner.cpp` provides `main()` for generated demo programs:

```cpp
satellite::emulator::configure_from_argv(argc, argv);
satellite_main();
return satellite::emulator::report() ? 0 : 1;
```

`make demos-run` passes each demo binary's base name to the runner. The emulator uses that name to select conditions such as injected bus timeouts, high thermal readings, low EPS voltage, and queued command events.

## Simulated conditions

Current demo-name driven conditions:

- names containing `fault` inject one bus timeout,
- names containing `thermal` or `realistic` set panel temperature above the watchdog threshold,
- names containing `command` or `realistic` enqueue a `cmd:reboot` event,
- names containing `realistic` run at least four recurring iterations and lower EPS voltage.

Set `SATELLITE_EMU_ITERATIONS=N` to override the recurring scheduler iteration count for experiments.

## Runtime report

Every demo prints:

- telemetry frame count and values,
- active fault counts,
- resource leak errors if any bus/device remains locked,
- emulator log entries for registration, bus operations, scheduler events, faults, and telemetry.

A non-zero exit code means the emulator detected an error such as leaked resources or an uncaught task exception.

## Validation commands

```bash
make demos-check
make demos-transpile
make demos-compile
make demos-run
make demos-validate
```

`make smoke` includes `make demos-validate`.
