import { z } from 'zod';

/** Maximum description length, counted in Unicode code points (research.md §5). */
export const DESCRIPTION_MAX_LENGTH = 500;

export const ERROR_CODES = ['VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_ERROR'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface Todo {
  id: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoRequest {
  description: string;
}

export interface UpdateTodoRequest {
  completed: boolean;
}

export interface ListTodosResponse {
  items: Todo[];
}

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

export const DESCRIPTION_MESSAGES = {
  empty: 'Please enter a task description.',
  tooLong: `Descriptions can be at most ${DESCRIPTION_MAX_LENGTH} characters.`,
  notSingleLine: 'Descriptions must be a single line of text.',
} as const;

// eslint-disable-next-line no-control-regex -- deliberately matching control characters
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export function countCodePoints(s: string): number {
  return [...s].length;
}

export const descriptionSchema = z
  .string({ error: DESCRIPTION_MESSAGES.empty })
  .trim()
  .min(1, { error: DESCRIPTION_MESSAGES.empty, abort: true })
  .refine((s) => countCodePoints(s) <= DESCRIPTION_MAX_LENGTH, {
    error: DESCRIPTION_MESSAGES.tooLong,
    abort: true,
  })
  .refine((s) => !CONTROL_CHARACTERS.test(s), { error: DESCRIPTION_MESSAGES.notSingleLine });

export type ParseDescriptionResult = { ok: true; value: string } | { ok: false; message: string };

/** Validates and normalizes a description. Used by both the UI and the API (FR-015). */
export function parseDescription(input: unknown): ParseDescriptionResult {
  const result = descriptionSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, message: result.error.issues[0]?.message ?? DESCRIPTION_MESSAGES.empty };
}
