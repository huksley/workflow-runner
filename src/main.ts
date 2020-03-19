import * as t from 'io-ts'
import { findPayload, apiResponse } from './util'

import { Context as LambdaContext, APIGatewayEvent, Callback as LambdaCallback } from 'aws-lambda'
import { logger as log } from './logger'
import { config } from './config'
import * as R from 'ramda'

export const InputPayload = t.type({})

// Typescript input type
export type Input = t.TypeOf<typeof InputPayload>

// Output payload format
export const OutputPayload = InputPayload

export type Output = t.TypeOf<typeof OutputPayload>

/** Invoked on API Gateway call */
export const handler = (
  event: APIGatewayEvent,
  context: LambdaContext,
  callback: LambdaCallback,
) => {
  log.info(
    'event(' +
      typeof event +
      ') ' +
      JSON.stringify(event, null, 2) +
      ' context ' +
      JSON.stringify(context, null, 2),
  )

  const payload = findPayload(event)
  log.info(`Using payload`, payload)

  try {
    const result = R.assoc('config', config, {})
    apiResponse(event, context, callback).success(result)
  } catch (error) {
    apiResponse(event, context, callback).failure('Failed to resize: ' + error)
  }
}

import { EventEmitter } from 'events'

import {
  WorkflowBuilder,
  WorkflowBase,
  StepExecutionContext,
  ExecutionResult,
  StepBody,
  configureWorkflow,
  MemoryPersistenceProvider,
  ConsoleLogger,
  WorkflowStatus,
  PollWorker,
} from '@huksley/workflow-es'

export const emitter = new EventEmitter()

class MyDataClass {
  public externalValue: any
}

class EmitPing extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    log.info('Pinging', context.workflow.id)
    emitter.emit('ping')
    return ExecutionResult.next()
  }
}

class EmitDone extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    log.info('Emitting done', context.workflow.id)
    emitter.emit('done')
    return ExecutionResult.next()
  }
}

class LogMessage extends StepBody {
  public message: string

  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    log.info('LogMessage: ' + this.message, context.workflow.id)
    return ExecutionResult.next()
  }
}

export class SampleWorkflow implements WorkflowBase<MyDataClass> {
  public id: string = 'test1'
  public version: number = 1

  public build(builder: WorkflowBuilder<any>) {
    builder
      .startWith(LogMessage)
      .input((step, _) => (step.message = 'Waiting for event...'))
      .then(EmitPing)
      .waitFor(
        'myEvent',
        _ => '0',
        _ => new Date(),
      )
      .output((step, data) => (data.externalValue = step.eventData))
      .then(LogMessage)
      .input((step, data) => (step.message = 'The event data is ' + data.externalValue))
      .then(LogMessage)
      .input((step, _) => (step.message = 'Complete'))
      .then(EmitDone)
  }
}

const main = async () => {
  const workflowConfig = configureWorkflow()
  const persistence = new MemoryPersistenceProvider()
  const pollWorker = new PollWorker()
  pollWorker.setInterval(500)
  workflowConfig.useLogger(new ConsoleLogger())
  workflowConfig.usePollWorker(pollWorker)
  workflowConfig.usePersistence(persistence)

  const host = workflowConfig.getHost()

  host.registerWorkflow(SampleWorkflow)
  await host.start()

  let workflowId = undefined as undefined | string

  emitter.on('ping', async () => {
    log.info('Got ping, sending event')
    await host.publishEvent('myEvent', '0', 'Hi!')
    if (workflowId !== undefined) {
      log.info(
        'Sent event to workflow: ' + workflowId,
        (await persistence.getWorkflowInstance(workflowId)).status === WorkflowStatus.Runnable,
      )
    }
  })

  emitter.on('done', () => {
    log.info('Workflow done')
    host.stop()
  })

  const myData = new MyDataClass()
  workflowId = await host.startWorkflow('test1', 1, myData)
  log.info(
    'Started workflow: ' + workflowId,
    (await persistence.getWorkflowInstance(workflowId)).status === WorkflowStatus.Runnable,
  )
}

if (require.main === module) {
  main()
}
