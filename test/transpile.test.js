import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { missionIRToJSON, TranspileError, transpile } from '../src/index.js';

const execFileAsync = promisify(execFile);

test('transpiles satellite-os imports, scheduler registrations, and bus calls', () => {
  const source = `
    import { bus, task, telemetry } from 'satellite-os'

    function selftestTask() {
      telemetry.emit('boot.selftest_started', true)
    }

    task.once('boot-selftest', selftestTask)
    task.every('housekeeping', '30s', async (ctx) => {
      if (ctx.iteration > 1000) ctx.stop()
      const i2c = await bus.open('i2c0', { clockHz: 400_000 })
      const response = await i2c.transact({ address: 0x48, write: Uint8Array.of(0x00), readLength: 2 })
      telemetry.emit('eps.raw_temperature_frame', response)
      await i2c.close()
    })
    task.start()
  `;

  const { code } = transpile(source, { filename: 'housekeeping.js' });

  assert.match(code, /#include "satellite_os\.hpp"/);
  assert.match(code, /auto selftestTask\(\)/);
  assert.match(code, /satellite::task::once\("boot-selftest", \[&\]\(auto&&\.\.\. args\) \{ return selftestTask\(args\.\.\.\); \}\);/);
  assert.match(code, /satellite::bus::open\("i2c0", satellite::Object\{\{"clockHz", 400000\}\}\)/);
  assert.match(code, /satellite::Bytes\{0x00\}/);
  assert.match(code, /satellite::telemetry::emit\("eps\.raw_temperature_frame", response\);/);
  assert.match(code, /satellite::task::start\(\);/);
});

test('transpiles device.register as a typed C++ driver registration', () => {
  const source = `
    import { device } from 'satellite-os'
    import { EPSDriver } from './drivers/eps.js'
    device.register('eps', EPSDriver, { bus: 'i2c0', address: 0x20 })
  `;

  const { code } = transpile(source, { filename: 'main.js' });

  assert.match(code, /#include "drivers\/eps\.hpp"/);
  assert.match(code, /satellite::device::register_driver<EPSDriver>\("eps", satellite::Object\{\{"bus", "i2c0"\}, \{"address", 0x20\}\}\);/);
});

function assertDiagnostic(source, code, messagePattern) {
  assert.throws(
    () => transpile(source, { filename: 'bad.js' }),
    (error) => {
      assert.ok(error instanceof TranspileError);
      assert.equal(error.diagnostics[0].code, code);
      assert.match(error.diagnostics[0].message, messagePattern);
      return true;
    },
  );
}

test('reports unsupported non-satellite imports with stable diagnostics', () => {
  assertDiagnostic(`import fs from 'node:fs'`, 'SATJS_IMPORT_UNSUPPORTED', /Unsupported import source/);
});

test('rejects console and timer APIs with satellite-os alternatives', () => {
  assertDiagnostic(
    `import { task } from 'satellite-os'; task.once('boot', () => { console.log('boot') })`,
    'SATJS_FORBIDDEN_API',
    /console\.\*/,
  );
  assertDiagnostic(
    `import { task } from 'satellite-os'; task.once('boot', () => { setInterval(() => {}, 1000) })`,
    'SATJS_FORBIDDEN_API',
    /setInterval/,
  );
});

test('rejects dynamic JavaScript runtime features', () => {
  assertDiagnostic(
    `import { task } from 'satellite-os'; task.once('boot', () => eval('1 + 1'))`,
    'SATJS_FORBIDDEN_API',
    /eval/,
  );
  assertDiagnostic(
    `import { task } from 'satellite-os'; task.once('boot', () => new Function('return 1'))`,
    'SATJS_FORBIDDEN_API',
    /new Function/,
  );
  assertDiagnostic(
    `import { task } from 'satellite-os'; task.once('boot', () => import('./late.js'))`,
    'SATJS_FORBIDDEN_API',
    /Dynamic import/,
  );
});

test('enforces top-level boot wiring policy and API contracts', () => {
  assertDiagnostic(
    `import { bus } from 'satellite-os'; bus.open('i2c0', {})`,
    'SATJS_TOP_LEVEL_POLICY',
    /Unsupported top-level/,
  );
  assertDiagnostic(
    `import { device } from 'satellite-os'; class EPSDriver {}; device.register('eps', EPSDriver, {})`,
    'SATJS_TOP_LEVEL_POLICY',
    /Unsupported top-level ClassDeclaration/,
  );
  assertDiagnostic(
    `import { device } from 'satellite-os'; const EPSDriver = {}; device.register('eps', EPSDriver, {})`,
    'SATJS_DRIVER_IMPORT',
    /not imported from a relative/,
  );
  assertDiagnostic(
    `import { task } from 'satellite-os'; task.every('housekeeping', () => {})`,
    'SATJS_API_ARITY',
    /task\.every expects 3 arguments/,
  );
  assertDiagnostic(
    `import { task } from 'satellite-os'; task.once('boot', 42)`,
    'SATJS_CALLBACK_SHAPE',
    /callback must be/,
  );
});

test('validates mission value shapes, byte literals, and driver option schemas', () => {
  assertDiagnostic(
    `import { device } from 'satellite-os'; import { EPSDriver } from './drivers/eps.js'; device.register('eps', EPSDriver, { bus: 'i2c0', address: '0x20' })`,
    'SATJS_DRIVER_OPTIONS',
    /address.*integer/,
  );
  assertDiagnostic(
    `import { task, telemetry } from 'satellite-os'; task.once('boot', () => telemetry.emit('eps.status', 'ok'))`,
    'SATJS_TELEMETRY_VALUE',
    /must not be strings/,
  );
  assertDiagnostic(
    `import { task, telemetry } from 'satellite-os'; task.once('boot', () => telemetry.emit('eps.frame', Uint8Array.of(999)))`,
    'SATJS_VALUE_SHAPE',
    /0\.\.255/,
  );
  assertDiagnostic(
    `import { task, telemetry } from 'satellite-os'; task.once('boot', () => telemetry.emit('eps.object', { volts: 3.3 }))`,
    'SATJS_TELEMETRY_VALUE',
    /arbitrary objects/,
  );
});

test('analyzes resource lifecycle for bus and device handles', () => {
  assertDiagnostic(
    `import { bus, task } from 'satellite-os'; task.once('boot', async () => { const i2c = await bus.open('i2c0', {}) })`,
    'SATJS_RESOURCE_LIFECYCLE',
    /not closed/,
  );
  assertDiagnostic(
    `import { bus, task } from 'satellite-os'; task.once('boot', async (ctx) => { const i2c = await bus.open('i2c0', {}); if (ctx.iteration > 1) await i2c.close() })`,
    'SATJS_RESOURCE_LIFECYCLE',
    /conditional path/,
  );
  assertDiagnostic(
    `import { bus, task } from 'satellite-os'; task.once('boot', async () => { const a = await bus.open('i2c0', {}); const b = await bus.open('i2c0', {}); await a.close(); await b.close() })`,
    'SATJS_RESOURCE_INTERLEAVING',
    /opened again/,
  );

  const returned = `import { bus, task } from 'satellite-os'; function makeBus() { const i2c = bus.open('i2c0', {}); return i2c } task.once('boot', () => {})`;
  assert.doesNotThrow(() => transpile(returned, { filename: 'factory.js' }));

  const transferred = `import { bus, task } from 'satellite-os'; task.once('boot', async () => { const i2c = await bus.open('i2c0', {}); transferResource(i2c) })`;
  assert.doesNotThrow(() => transpile(transferred, { filename: 'transfer.js' }));
});

test('returns a mission IR for boot operations', () => {
  const source = `
    import { device, task } from 'satellite-os'
    import { EPSDriver } from './drivers/eps.js'
    function boot() {}
    device.register('eps', EPSDriver, { bus: 'i2c0', address: 0x20 })
    task.once('boot', boot)
    task.start()
  `;

  const { ir } = transpile(source, { filename: 'main.js' });
  assert.deepEqual(ir.boot.map((operation) => operation.kind), [
    'RegisterDevice',
    'RegisterTask',
    'StartScheduler',
  ]);
  assert.equal(ir.boot[1].mode, 'once');
  assert.match(missionIRToJSON(ir), /RegisterDevice/);
});

test('CLI writes generated C++ to --out', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'satjs-cpp-'));
  try {
    const output = join(dir, 'housekeeping.cpp');
    await execFileAsync('node', ['src/cli.js', 'examples/housekeeping.js', '--out', output]);
    const generated = await readFile(output, 'utf8');
    assert.match(generated, /void satellite_main\(\)/);
    assert.match(generated, /satellite::task::every/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
