import { task } from 'satellite-os'

task.once('boot', () => {
  console.log('boot')
})
