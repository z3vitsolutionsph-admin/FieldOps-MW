import { z } from 'zod';
import { badRequest } from './http';

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errorDetails = result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : 'root',
      message: issue.message,
      code: issue.code,
    }));

    const fieldMessages = errorDetails
      .map((item) => `${item.field}: ${item.message}`)
      .join('; ');

    throw badRequest(`Validation failed: ${fieldMessages}`, errorDetails, 'VALIDATION_FAILED');
  }
  return result.data;
}
