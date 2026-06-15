Here's a minimal, real satellite onboard JS API kernel — focused on the contracts, not implementation:

---

## `satellite-os` — Kernel API Design

The philosophy: **everything is a resource with a lifecycle**. No magic globals. No callback soup. Deterministic, auditable, testable on the ground.

---

### Core Concepts

```js
// satellite-os/index.js — the whole kernel surface

import { bus } from './bus.js'
import { device } from './device.js'
import { task } from './task.js'
import { telemetry } from './telemetry.js'
import { fault } from './fault.js'

export { bus, device, task, telemetry, fault }
```

---

### 1. `bus` — Hardware Bus Access

The physical backbone. I²C, SPI, UART — all addressable the same way.

```js
import { bus } from 'satellite-os'

// Acquire a bus handle. Throws if locked by another task.
const i2c = await bus.open('i2c0', { clockHz: 400_000 })

// Raw transact — write then read in one atomic op
const response = await i2c.transact({
  address: 0x48,
  write: Uint8Array.of(0x00),   // register pointer
  readLength: 2,
})

await i2c.close()
```

**Design decisions:**
- `transact()` is atomic — no interleaved frames from other tasks
- Bus is released on close or task death (no resource leaks across resets)
- No implicit retry — caller decides fault policy

---

### 2. `device` — Named Subsystem Drivers

A driver registry. Drivers wrap a bus handle and expose a typed interface.

```js
import { device } from 'satellite-os'

// Register a driver at boot (done once, in manifest)
device.register('eps', EPSDriver, { bus: 'i2c0', address: 0x20 })

// Anywhere in the system, acquire by name
const eps = await device.acquire('eps')

const power = await eps.getBusVoltage('3v3')   // → { volts: 3.31, timestamp: 1718320000412 }
await eps.setOutput('heater_1', true)

device.release('eps')
```

**Design decisions:**
- `acquire` / `release` prevents concurrent access by mistake
- Drivers expose domain types, not raw bytes — callers never touch registers
- Drivers are stateless objects; all state lives in hardware or `telemetry`

---

### 3. `task` — Scheduled Work

The scheduler. Everything runs as a named, observable task.

```js
import { task } from 'satellite-os'

// One-shot
task.once('boot-selftest', async () => {
  // ...
})

// Recurring
task.every('housekeeping', '30s', async (ctx) => {
  if (ctx.iteration > 1000) ctx.stop()   // tasks can self-terminate
  // ...
})

// Triggered by an external event (uplink command, pin interrupt, etc.)
task.on('cmd:reboot', async (payload) => {
  await task.shutdown({ gracePeriodMs: 500 })
})
```

**Design decisions:**
- Tasks have names — visible in fault logs and telemetry
- `ctx.stop()` is the only safe way to end a recurring task from inside
- No anonymous functions at the top level — everything is traceable

---

### 4. `telemetry` — Structured Observability

Not `console.log`. Structured, typed, downlinkable frames.

```js
import { telemetry } from 'satellite-os'

// Emit a telemetry point — stored in ring buffer, queued for downlink
telemetry.emit('thermal.panel_temp_c', 42.7)
telemetry.emit('adcs.attitude_quaternion', [w, x, y, z])

// Snapshot — everything emitted in the last window
const snapshot = telemetry.snapshot({ since: Date.now() - 60_000 })

// Subscribe on-board (e.g. to trigger a fault response)
telemetry.watch('thermal.panel_temp_c', { above: 85 }, (reading) => {
  fault.raise('THERMAL_OVERTEMP', reading)
})
```

**Design decisions:**
- Flat dotted namespaces — `subsystem.metric_name_unit`
- Values are primitives or typed arrays — no blobs, no strings in hot path
- `watch` is the on-board equivalent of a ground alert — no polling needed

---

### 5. `fault` — Error Handling & Recovery

Faults are first-class, not exceptions.

```js
import { fault } from 'satellite-os'

// Raise a named fault with evidence
fault.raise('EPS_UNDERVOLTAGE', { volts: 2.8, threshold: 3.0 })

// Register a recovery handler
fault.handle('EPS_UNDERVOLTAGE', async (ctx) => {
  await task.pause('payload-camera', '5m')
  if (ctx.count > 3) fault.escalate(ctx)   // kick up to next severity level
})

// Query the active fault log
const active = fault.list()   // → [{ name, raised_at, count, status }]
```

**Design decisions:**
- Faults are named, counted, and timestamped — not thrown and lost
- `escalate()` moves up a severity ladder (WARN → ERROR → SAFE_MODE) — ladder is defined in the mission manifest, not here
- Recovery handlers are idempotent by contract

---

### Error Contract (everywhere)

```js
// All async API calls reject with a structured error — never a raw string
try {
  await i2c.transact(...)
} catch (e) {
  e.code    // 'BUS_TIMEOUT' | 'BUS_LOCKED' | 'NACK' | ...
  e.source  // 'i2c0'
  e.task    // 'housekeeping' — which task was running
  e.ts      // hardware timestamp
}
```

---

### What's explicitly NOT in the kernel

| Out of scope | Why |
|---|---|
| Crypto / auth | Mission-specific; inject as a driver |
| Uplink framing / CCSDS | Protocol layer above this |
| File I/O | Use telemetry ring buffer; no filesystem assumed |
| `setTimeout` / `setInterval` | Replaced entirely by `task.every` |
| `console.*` | Replaced entirely by `telemetry.emit` |

---

### Boot sequence sketch

```js
// main.js — the only file that runs at cold start
import { bus, device, task, telemetry, fault } from 'satellite-os'
import { EPSDriver } from './drivers/eps.js'
import { ADCSDriver } from './drivers/adcs.js'

// 1. Register hardware
device.register('eps',  EPSDriver,  { bus: 'i2c0', address: 0x20 })
device.register('adcs', ADCSDriver, { bus: 'spi0', cs: 2 })

// 2. Register fault handlers
fault.handle('EPS_UNDERVOLTAGE', epsUndervoltageHandler)

// 3. Schedule work
task.once('boot-selftest', selftestTask)
task.every('housekeeping', '30s', housekeepingTask)
task.on('cmd:*', commandDispatch)

// 4. Hand off to the scheduler — nothing below this line runs
task.start()
```

---

This kernel is small enough to fit in ~200KB of flash, has no hidden state, and every operation is traceable through `telemetry` and `fault`. The next layer up (ADCS control loops, payload sequencing, uplink parsers) all live outside this kernel and compose from these five primitives.
