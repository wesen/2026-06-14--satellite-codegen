import { fault, task, telemetry } from 'satellite-os'

fault.handle('THERMAL_OVERTEMP', async (ctx) => {
  telemetry.emit('fault.thermal_overtemp_count', ctx.count)
  await task.pause('payload-camera', '10m')
})

function configureThermalWatchdog() {
  telemetry.watch('thermal.panel_temp_c', { above: 85 }, (reading) => {
    fault.raise('THERMAL_OVERTEMP', reading)
  })
}

function sampleThermalPanel() {
  telemetry.emit('thermal.panel_temp_c', 91.5)
}

task.once('configure-thermal-watchdog', configureThermalWatchdog)
task.once('sample-thermal-panel', sampleThermalPanel)
task.start()
