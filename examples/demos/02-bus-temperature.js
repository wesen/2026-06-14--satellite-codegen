import { bus, task, telemetry } from 'satellite-os'

async function sampleTemperatureSensor() {
  const i2c = await bus.open('i2c0', { clockHz: 400_000 })
  const frame = await i2c.transact({
    address: 0x48,
    write: Uint8Array.of(0x00),
    readLength: 2,
  })

  telemetry.emit('thermal.raw_temperature_frame', frame)
  await i2c.close()
}

task.once('sample-temperature-sensor', sampleTemperatureSensor)
task.start()
