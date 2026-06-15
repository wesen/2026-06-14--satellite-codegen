import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { TranspileError, transpile } from '../src/index.js';

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

test('reports unsupported non-satellite imports with diagnostics', () => {
  const source = `import fs from 'node:fs'`;

  assert.throws(
    () => transpile(source, { filename: 'bad.js' }),
    (error) => {
      assert.ok(error instanceof TranspileError);
      assert.equal(error.diagnostics[0].code, 'SATJS_UNSUPPORTED_SYNTAX');
      assert.match(error.diagnostics[0].message, /Unsupported import source/);
      return true;
    },
  );
});

test('CLI writes generated C++ to --out', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'satjs-cpp-'));
  try {
    const output = join(dir, 'housekeeping.cpp');
    await execFileAsync('node', ['src/cli.js', 'examples/housekeeping.js', '--out', output]);
    const generated = await readFile(output, 'utf8');
    assert.match(generated, /auto satellite_main\(\)/);
    assert.match(generated, /satellite::task::every/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
