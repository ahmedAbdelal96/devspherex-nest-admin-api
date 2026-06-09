/**
 * Request ID Middleware (Functional)
 *
 * - Reads x-request-id from incoming headers (if valid)
 * - Generates a new ID when missing or invalid
 * - Attaches requestId to the request object
 * - Sets x-request-id response header
 */

import { Request, Response, NextFunction } from 'express';
import { REQUEST_ID_HEADER, REQUEST_ID_KEY, getOrCreateRequestId } from './request-id.util';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = getOrCreateRequestId(req.headers as Record<string, string | string[] | undefined>);
  (req as unknown as Record<string, unknown>)[REQUEST_ID_KEY] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
