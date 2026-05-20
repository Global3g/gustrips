/**
 * Centralized error handling. Provides:
 *  - HttpError class for typed errors raised from handlers/services
 *  - asyncHandler wrapper so async route handlers can `throw` safely
 *  - errorHandler middleware that serializes everything as ApiError
 *  - notFoundHandler for unmatched routes
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ApiError } from '../models/types';

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, unknown>): HttpError {
    return new HttpError(400, 'invalid_request', message, details);
  }

  static notFound(message = 'Resource not found'): HttpError {
    return new HttpError(404, 'not_found', message);
  }

  static unauthorized(message = 'Unauthorized'): HttpError {
    return new HttpError(401, 'unauthorized', message);
  }

  static internal(message = 'Internal server error'): HttpError {
    return new HttpError(500, 'internal', message);
  }
}

/**
 * Wrap async handlers so thrown errors / rejected promises hit the
 * Express error pipeline instead of becoming unhandled rejections.
 */
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  const err: ApiError = {
    code: 'not_found',
    message: `No handler matches ${req.method} ${req.originalUrl}`,
  };
  res.status(404).json(err);
}

 
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next is required by Express to recognize this as an error handler
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    const body: ApiError = {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    };
    res.status(err.status).json(body);
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[tripshistory] unhandled error:', err);

  const body: ApiError = {
    code: 'internal',
    message: 'Internal server error',
    details: { reason: message },
  };
  res.status(500).json(body);
}
