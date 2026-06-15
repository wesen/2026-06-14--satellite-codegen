# Demo Ladder

These demos are ordered from easiest to more realistic:

1. `01-boot-telemetry.js` — boot beacon and clock lowering.
2. `02-bus-temperature.js` — bus open/transact/close lifecycle.
3. `03-device-heater-control.js` — driver registration, device acquire/release, output control.
4. `04-fault-recovery.js` — injected bus timeout, try/catch, fault handler, recovery telemetry.
5. `05-thermal-watchdog.js` — telemetry threshold watcher that raises a fault.
6. `06-command-safe-mode.js` — recurring housekeeping, repeated fault escalation, command shutdown.
7. `07-realistic-mission-loop.js` — integrated boot, watchdog, bus, device, telemetry, fault, and command flow.

Run all demos through the emulator:

```bash
make demos-validate
```

Generated C++ and binaries are written under `build/demos/`.
