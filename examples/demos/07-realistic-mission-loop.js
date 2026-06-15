import { bus, device, fault, task, telemetry } from 'satellite-os'
import { EPSDriver } from '../drivers/eps.js'
import { ADCSDriver } from '../drivers/adcs.js'

device.register('eps', EPSDriver, { bus: 'i2c0', address: 0x20 })
device.register('adcs', ADCSDriver, { bus: 'spi0', cs: 2 })

fault.handle('THERMAL_OVERTEMP', async (ctx) => {
  telemetry.emit('fault.thermal_overtemp_count', ctx.count)
  await task.pause('payload-camera', '10m')
  if (ctx.count > 2) fault.escalate(ctx)
})

fault.handle('EPS_UNDERVOLTAGE', async (ctx) => {
  telemetry.emit('fault.eps_undervoltage_count', ctx.count)
  await task.pause('payload-camera', '5m')
  if (ctx.count > 3) fault.escalate(ctx)
})

function configureWatchdogs() {
  telemetry.watch('thermal.panel_temp_c', { above: 85 }, (reading) => {
    fault.raise('THERMAL_OVERTEMP', reading)
  })
}

function bootSelftest() {
  telemetry.emit('boot.selftest_started', true)
  telemetry.emit('adcs.attitude_quaternion', [1, 0, 0, 0])
}

task.once('configure-watchdogs', configureWatchdogs)
task.once('boot-selftest', bootSelftest)

task.every('mission-housekeeping', '30s', async (ctx) => {
  const i2c = await bus.open('i2c0', { clockHz: 400_000 })
  const thermalFrame = await i2c.transact({
    address: 0x48,
    write: Uint8Array.of(0x00),
    readLength: 2,
  })
  telemetry.emit('thermal.raw_temperature_frame', thermalFrame)
  await i2c.close()

  const eps = await device.acquire('eps')
  await eps.setOutput('heater_1', true)
  device.release('eps')

  telemetry.emit('thermal.panel_temp_c', 91.5)
  if (ctx.iteration > 1) {
    fault.raise('EPS_UNDERVOLTAGE', { volts: 2.82, threshold: 3.0 })
  }
  if (ctx.iteration > 3) ctx.stop()
})

task.on('cmd:reboot', async () => {
  telemetry.emit('cmd.reboot_received', true)
  await task.shutdown({ gracePeriodMs: 500 })
})

task.start()
