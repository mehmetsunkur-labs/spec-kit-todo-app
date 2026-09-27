import type { ErrorCode, ErrorDetail, ErrorResponse } from '@todo/shared';
import { DESCRIPTION_MESSAGES } from '@todo/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(): AppError {
  return new AppError(404, 'NOT_FOUND', 'This task no longer exists.');
}

export function validationError(message: string, details?: ErrorDetail[]): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message, details);
}

const INTERNAL_MESSAGE = 'Something went wrong. Your change was not saved.';
const INVALID_BODY_MESSAGE = 'The request body is not valid.';

function envelope(code: ErrorCode, message: string, details?: ErrorDetail[]): ErrorResponse {
  return { error: details ? { code, message, details } : { code, message } };
}

type AjvError = NonNullable<FastifyError['validation']>[number];

/** Maps one Ajv error to `{ field, message }`, naming the offending property (tasks F3). */
function toDetail(error: AjvError, context: string | undefined): ErrorDetail {
  const params = error.params as Record<string, unknown>;

  if (error.keyword === 'additionalProperties' && typeof params.additionalProperty === 'string') {
    const field = params.additionalProperty;
    return { field, message: `Unknown field "${field}".` };
  }

  const field =
    error.keyword === 'required' && typeof params.missingProperty === 'string'
      ? params.missingProperty
      : error.instancePath.replace(/^\//, '') || context || 'body';

  if (field === 'description') return { field, message: DESCRIPTION_MESSAGES.empty };
  if (field === 'completed') return { field, message: 'completed must be true or false.' };
  if (field === 'id') return { field, message: 'The task id is not valid.' };
  return { field, message: 'The request is not valid.' };
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send(envelope(error.code, error.message, error.details));
    return;
  }

  const fastifyError = error as FastifyError;

  if (fastifyError.validation) {
    const details = fastifyError.validation.map((e) => toDetail(e, fastifyError.validationContext));
    reply.status(400).send(envelope('VALIDATION_ERROR', details[0]!.message, details));
    return;
  }

  // Malformed JSON, unsupported content type, body too large, etc.
  const status = fastifyError.statusCode;
  if (status !== undefined && status >= 400 && status < 500) {
    reply.status(400).send(envelope('VALIDATION_ERROR', INVALID_BODY_MESSAGE));
    return;
  }

  request.log.error({ err: error }, 'unhandled error');
  reply.status(500).send(envelope('INTERNAL_ERROR', INTERNAL_MESSAGE));
}

export function sendNotFound(reply: FastifyReply): void {
  reply.status(404).send(envelope('NOT_FOUND', 'The requested resource does not exist.'));
}
