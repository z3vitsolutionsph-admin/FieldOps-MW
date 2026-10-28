import type { z } from 'zod';
import { badRequest } from './http';

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest('Request validation failed', issues);
  }
  return result.data;
}
