# Supported Mission Script Subset

This document describes the JavaScript subset accepted by `satjs-cpp`.

## Imports

Allowed:

```js
import { bus, device, task, telemetry, fault } from 'satellite-os'
import { EPSDriver } from './drivers/eps.js'
```

Rejected:

- Node built-ins such as `node:fs`.
- npm packages.
- dynamic `import()`.
- default imports from `satellite-os`.

## Top-level code

Allowed top-level forms:

- imports,
- named function declarations,
- `const` declarations,
- `device.register(...)`,
- `fault.handle(...)`,
- `task.once(...)`,
- `task.every(...)`,
- `task.on(...)`,
- `task.start()`.

Other side effects are rejected so generated `satellite_main()` remains auditable.

## Forbidden runtime APIs

Use satellite APIs instead of browser/Node-style runtime APIs:

- `console.*` → use `telemetry.emit`.
- `setTimeout` / `setInterval` → use `task.once`, `task.every`, or scheduler APIs.
- `eval`, `new Function`, `new Proxy`, `Reflect.*` → unsupported because mission code must be statically analyzable.

## Values

Allowed mission values:

- null,
- booleans,
- safe integer literals,
- finite floating-point literals,
- strings in configuration positions,
- `Uint8Array.of(byte, ...)`,
- arrays without holes/spreads,
- object literals without spreads, methods, or computed keys.

Telemetry values are stricter: do not emit string values or arbitrary object blobs. Emit flat dotted numeric/boolean/byte/array metrics instead.

## Resource lifecycle

Handles returned by `bus.open(...)` and `device.acquire(...)` must be closed/released, returned, or deliberately transferred.

```js
task.once('ok', async () => {
  const i2c = await bus.open('i2c0', {})
  await i2c.close()
})
```

Conditional-only cleanup is rejected because it can leak resources on other paths.
