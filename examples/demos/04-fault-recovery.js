import { bus, fault, task, telemetry } from 'satellite-os'

fault.handle('BUS_TIMEOUT', async (ctx) => {
  telemetry.emit('fault.bus_timeout_count', ctx.count)
  await task.pause('payload-camera', '2m')
})

async function sampleWithRecovery() {
  const i2c = await bus.open('i2c0', { clockHz: 100_000 })

  try {
    await i2c.transact({
      address: 0x48,
      write: Uint8Array.of(0x00),
      readLength: 2,
    })
  } catch (e) {
    fault.raise('BUS_TIMEOUT', { attempt: 1, address: 0x48 })
  }

  await i2c.close()
  telemetry.emit('bus.i2c0_recovered', true)
}

task.once('sample-with-recovery', sampleWithRecovery)
task.start()
