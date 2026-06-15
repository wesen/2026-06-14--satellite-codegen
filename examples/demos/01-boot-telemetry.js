import { task, telemetry } from 'satellite-os'

function bootBeacon() {
  telemetry.emit('boot.started', true)
  telemetry.emit('boot.timestamp_ms', Date.now())
}

task.once('boot-beacon', bootBeacon)
task.start()
