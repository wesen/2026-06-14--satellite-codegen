import { bus, device, task, telemetry, fault } from 'satellite-os'
import { EPSDriver } from './drivers/eps.js'

function epsUndervoltageHandler(ctx) {
  task.pause('payload-camera', '5m')
  if (ctx.count > 3) fault.escalate(ctx)
}

function selftestTask() {
  telemetry.emit('boot.selftest_started', true)
}

device.register('eps', EPSDriver, { bus: 'i2c0', address: 0x20 })
fault.handle('EPS_UNDERVOLTAGE', epsUndervoltageHandler)

task.once('boot-selftest', selftestTask)

task.every('housekeeping', '30s', async (ctx) => {
  if (ctx.iteration > 1000) ctx.stop()

  const i2c = await bus.open('i2c0', { clockHz: 400_000 })
  const response = await i2c.transact({
    address: 0x48,
    write: Uint8Array.of(0x00),
    readLength: 2,
  })

  telemetry.emit('eps.raw_temperature_frame', response)
  await i2c.close()
})

task.start()
