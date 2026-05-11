/**
 * Auth middleware. Verifies a Firebase ID token from the
 * `Authorization: Bearer <token>` header and attaches `req.userId`
 * for downstream handlers. Rejects with 401 if missing/invalid.
 */
import type { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/firestore';
import type { ApiError } from '../models/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      authToken?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization') || req.header('Authorization');

  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    const err: ApiError = {
      code: 'unauthorized',
      message: 'Missing or malformed Authorization header. Expected "Bearer <Firebase ID token>".',
    };
    res.status(401).json(err);
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    const err: ApiError = {
      code: 'unauthorized',
      message: 'Empty bearer token.',
    };
    res.status(401).json(err);
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.userId = decoded.uid;
    req.authToken = token;
    next();
  } catch (e) {
    const err: ApiError = {
      code: 'unauthorized',
      message: 'Invalid or expired Firebase ID token.',
      details: { reason: (e as Error).message },
    };
    res.status(401).json(err);
    return;
  }
}
