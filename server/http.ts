import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** An error whose message is safe to show to API clients. Anything else is reported as a generic 500. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'ERROR',
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, 'BAD_REQUEST', details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg, 'UNAUTHENTICATED');
export const forbidden = (msg = 'You do not have permission to perform this action') =>
  new HttpError(403, msg, 'FORBIDDEN');
export const notFound = (msg = 'Resource not found') => new HttpError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string, details?: unknown) => new HttpError(409, msg, 'CONFLICT', details);
export const unprocessable = (msg: string, details?: unknown) => new HttpError(422, msg, 'UNPROCESSABLE', details);

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}

/** Wraps async handlers so rejected promises reach the error middleware (Express 4 does not do this itself). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
