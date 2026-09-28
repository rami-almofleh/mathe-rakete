import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyToken } from './jwt.js';

// Augmentiert Express' eigenen Request-Typ statt eines separaten Interfaces – so lässt sich
// `req.userId` überall ohne Typ-Cast lesen, sobald `requireAuth` durchgelaufen ist.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  try {
    req.userId = verifyToken(token).sub;
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
};
