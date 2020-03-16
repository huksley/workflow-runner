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

const emitter = new EventEmitter();

class EmitPing extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    console.info('Pinging', context.workflow.id)
    emitter.emit('ping')
    return exec.next()
  }
}

class EmitDone extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    console.info('Sending done', context.workflow.id)
    emitter.emit('done')
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
  public version: number = 1

  public build(builder: WorkflowBuilder<any>) {
    builder
      .startWith(LogMessage)
      .input((step, _) => (step.message = 'Waiting for event...'))
      .then(EmitPing)
      .waitFor('myEvent', _ => '0')
      .output((step, data) => (data.externalValue = step.eventData))
      .then(LogMessage)
      .input((step, data) => (step.message = 'The event data is ' + data.externalValue))
      .then(LogMessage)
      .input((step, _) => (step.message = 'Complete'))
      .then(EmitDone)
  }
}


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
  }).timeout(10000)
})
