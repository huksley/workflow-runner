import * as assert from 'assert'
import { configureWorkflow, MemoryPersistenceProvider, ConsoleLogger } from '@huksley/workflow-es'

import { emitter, SampleWorkflow } from '../src/main'

describe('main.ts', () => {
  it('can start workflow', async () => {
    return new Promise(async resolve => {
      const config = configureWorkflow()
      assert.ok(config)
      const persistence = new MemoryPersistenceProvider()
      config.useLogger(new ConsoleLogger())
      config.usePersistence(persistence)
      const host = config.getHost()
      assert.ok(host)
      host.registerWorkflow(SampleWorkflow)
      await host.start()

      emitter.on('ping', () => {
        console.info('Sending event')
        host.publishEvent('myEvent', '0', 'Hi!')
      })

      emitter.on('done', () => {
        console.info('Workflow done')
        assert.ok(true)
        resolve(true)
      })

      const id = await host.startWorkflow('test1', 1, {})
      assert.ok(id)
      console.log('Started workflow: ' + id)
    })
  }).timeout(10000)
})
