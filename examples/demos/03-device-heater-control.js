import { device, task, telemetry } from 'satellite-os'
import { EPSDriver } from '../drivers/eps.js'

device.register('eps', EPSDriver, { bus: 'i2c0', address: 0x20 })

async function enableSurvivalHeater() {
  const eps = await device.acquire('eps')
  await eps.setOutput('heater_1', true)
  telemetry.emit('thermal.heater_1_enabled', true)
  device.release('eps')
}

task.once('enable-survival-heater', enableSurvivalHeater)
task.start()
