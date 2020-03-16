import * as t from 'io-ts'
import {
  findPayload,
  apiResponse,
} from './util'

import { Context as LambdaContext, APIGatewayEvent, Callback as LambdaCallback } from 'aws-lambda'
import { logger as log } from './logger'
import { config } from './config'
import * as R from 'ramda'

/**
 * Image crop rectangle. Usually a face to focus on.
 * Values are a 0..1 of total width/height of the image.
 */
export const RectPayload = t.type({
  top: t.number,
  left: t.number,
  width: t.number,
  height: t.number,
})

export type Rect = t.TypeOf<typeof RectPayload>

export const InputPayload = t.intersection([
  t.type({
    // Required s3://bucket/path.jpg
    s3Url: t.string,
  }),
  t.partial({
    // Optional face
    faceRect: RectPayload,
    // Optional target path
    dstS3Url: t.string,
    // Pixel width
    width: t.number,
    // Pixel height
    height: t.number,
    // Target format
    format: t.union([t.literal('png'), t.literal('jpg')]),
    // Check thumbnail exists (only S3 object existence checked)
    checkExists: t.boolean,
    // Produce large image crop than specified by factRect (zoom out), 2 - twice the size
    zoomOut: t.number,
  }),
])

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
  logger.info(`Using payload`, payload)

  try {
    const result = R.assoc("config", config, {})
    apiResponse(event, context, callback).success(result)
  } catch (error) {
    apiResponse(event, context, callback).failure('Failed to resize: ' + error)
  }
}
