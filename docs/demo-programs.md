# Demo Programs

The `examples/demos/` directory contains a progression of mission scripts from minimal boot code to a realistic multi-subsystem loop. Every demo is meant to be transpiled to C++, linked against the emulator runtime, and executed locally.

Run all demos:

```bash
make demos-validate
```

That target performs:

1. `satjs-cpp --check` validation for each JS file.
2. C++ generation into `build/demos/*.cpp`.
3. C++ compile/link into `build/demos/<demo-name>`.
4. Execution under `examples/demo_runner.cpp` and `runtime/satellite_os.hpp`.

## Demo ladder

| Demo | Focus | What it exercises |
|---|---|---|
| `01-boot-telemetry.js` | Minimal boot task | `task.once`, `task.start`, `telemetry.emit`, `Date.now()` lowering. |
| `02-bus-temperature.js` | Hardware bus read | `bus.open`, `transact`, `Uint8Array.of`, object options, resource close. |
| `03-device-heater-control.js` | Named driver/device access | `device.register`, `device.acquire`, device method call, `device.release`. |
| `04-fault-recovery.js` | Error path and recovery | `try/catch`, emulated bus timeout, `fault.raise`, `fault.handle`, `task.pause`. |
| `05-thermal-watchdog.js` | Telemetry watch to fault | `telemetry.watch`, threshold criteria, watcher callback, fault handler. |
| `06-command-safe-mode.js` | Command event and safe-mode style response | recurring task, repeated faults, escalation, `task.on`, `task.shutdown`. |
| `07-realistic-mission-loop.js` | Integrated mission loop | device registration, boot self-test, watchdogs, recurring housekeeping, bus/device lifecycles, faults, command shutdown. |

## Adding a new demo

1. Add `examples/demos/NN-name.js`.
2. Keep top-level code to mission boot wiring (`device.register`, `fault.handle`, `task.once/every/on`, `task.start`).
3. Close `bus.open` handles and release `device.acquire` handles.
4. Run:

```bash
make demos-validate
```

If the demo needs a new simulated condition, extend `satellite::emulator::configure_demo()` in `runtime/satellite_os.hpp` and key the condition off the demo name or an environment variable.
