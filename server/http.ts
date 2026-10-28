import { Request, Response, NextFunction, RequestHandler } from 'express';

export class HttpError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export const badRequest = (message = 'Bad Request', details?: any, code = 'BAD_REQUEST') =>
  new HttpError(400, message, code, details);

export const unauthorized = (message = 'Unauthorized', details?: any, code = 'UNAUTHORIZED') =>
  new HttpError(401, message, code, details);

export const forbidden = (message = 'Forbidden', details?: any, code = 'FORBIDDEN') =>
  new HttpError(403, message, code, details);

export const notFound = (message = 'Not Found', details?: any, code = 'NOT_FOUND') =>
  new HttpError(404, message, code, details);

export const conflict = (message = 'Conflict', details?: any, code = 'CONFLICT') =>
  new HttpError(409, message, code, details);

export const unprocessable = (message = 'Unprocessable Entity', details?: any, code = 'UNPROCESSABLE_ENTITY') =>
  new HttpError(422, message, code, details);

export const ok = (res: Response, data: any, status = 200) => {
  return res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
