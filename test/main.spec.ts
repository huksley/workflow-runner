import * as assert from 'assert'
import { EventEmitter } from 'events'

import {
  WorkflowBuilder,
  WorkflowBase,
  StepExecutionContext,
  ExecutionResult as exec,
  configureWorkflow,
  ExecutionResult,
  StepBody,
} from 'workflow-es'

const timestamp = new Date().getTime()
const mem = new Int32Array(new SharedArrayBuffer(4));
Atomics.store(mem, 0, 0);

class PingBack extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    console.info('Pinging', context.workflow.id)
    Atomics.add(mem, 0, 255)
    Atomics.notify(mem, 0, 999)
    return exec.next()
  }
}

class Eol extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    console.info('Done', context.workflow.id)
    return exec.next()
  }
}

class LogMessage extends StepBody {
  public message: string

  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    console.info("LogMessage: " + this.message, context.workflow.id)
    return ExecutionResult.next()
  }
}

class SampleWorkflow implements WorkflowBase<any> {
  public id: string = 'test1'
  public version: number = timestamp

  public build(builder: WorkflowBuilder<any>) {
    builder
      .startWith(LogMessage)
      .input((step, _) => (step.message = 'Waiting for event...'))
      .then(PingBack)
      .waitFor('myEvent', _ => '0')
      .output((step, data) => (data.externalValue = step.eventData))
      .then(LogMessage)
      .input((step, data) => (step.message = 'The event data is ' + data.externalValue))
      .then(Eol)
  }
}

function* gen() {
  while (Atomics.load(mem, 0) === 0) {
    yield false
  }
  return true
}

describe('main.ts', () => {
  it('can start workflow', async () => {
   
    const config = configureWorkflow()
    assert.notEqual(config, null)
    const host = config.getHost()
    assert.notEqual(host, null)
    host.registerWorkflow(SampleWorkflow)
    await host.start()
    const id = await host.startWorkflow('test1', timestamp, null)
    assert.ok(id)
    console.log('Started workflow: ' + id)
    const iter = gen()
    let finished = await iter.next()
    console.info(iter.next())
    //await new Promise(resolve => setTimeout(() => resolve(), 5000));
    return new Promise(async resolve => {
      let tries = 0
      const startTime = new Date().getTime()
      while (!finished.done && tries <1000) { tries++; finished = await iter.next(); console.info(tries + ", ", finished) }
      console.info("Received ping " + id + " in " + (new Date().getTime() - startTime) + "ms")
      console.info('Sending event ' + id, Atomics.load(mem, 0))
      host.publishEvent('myEvent', '0', "Hi!", new Date())
      console.info('Waiting for event processing ' + id, Atomics.load(mem, 0))
      await new Promise(resolve => setTimeout(() => resolve(), 5000));
      resolve(1)
    })
  }).timeout(20000)
})
