import { fault, task, telemetry } from 'satellite-os'

fault.handle('EPS_UNDERVOLTAGE', async (ctx) => {
  telemetry.emit('fault.eps_undervoltage_count', ctx.count)
  await task.pause('payload-camera', '5m')
  if (ctx.count > 2) fault.escalate(ctx)
})

task.on('cmd:reboot', async () => {
  telemetry.emit('cmd.reboot_received', true)
  await task.shutdown({ gracePeriodMs: 500 })
})

task.every('power-housekeeping', '30s', async (ctx) => {
  telemetry.emit('housekeeping.iteration', ctx.iteration)
  fault.raise('EPS_UNDERVOLTAGE', { volts: 2.8, threshold: 3.0 })
  if (ctx.iteration > 2) ctx.stop()
})

task.start()
