import * as assert from 'assert'
import {
  configureWorkflow
} from 'workflow-es'

import { emitter, SampleWorkflow } from "../src/main"

describe('main.ts', () => {
  it('can start workflow', async () => {
   
    const config = configureWorkflow()
    assert.ok(config)
    const host = config.getHost()
    assert.ok(host)
    host.registerWorkflow(SampleWorkflow)
    await host.start()

    emitter.on('ping', () => {
      console.info("Sending event")
      host.publishEvent('myEvent', '0', "Hi!", new Date())
    })

    emitter.on('done', () => {
      console.info("Workflow done")
      assert.ok(true)
    })

    const id = await host.startWorkflow('test1', 1, null)
    assert.ok(id)
    console.log('Started workflow: ' + id)
    await new Promise(resolve => setTimeout(() => resolve(), 5000));
  }).timeout(10000)
})
