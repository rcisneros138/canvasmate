import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOpts {
  /** Window length in ms. */
  windowMs: number;
  /** Maximum requests per window. */
  max: number;
  /** Optional key function — defaults to req.ip. */
  keyFn?: (req: Request) => string;
}

/**
 * Tiny in-memory IP rate-limiter. Resets on process restart, which is fine for
 * a single-instance deploy. Layered limiters compose (e.g. 5/hr + 20/day).
 */
export function rateLimit(opts: RateLimitOpts) {
  const hits = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = (opts.keyFn ? opts.keyFn(req) : req.ip) || 'unknown';
    const now = Date.now();
    const bucket = hits.get(key);

    if (!bucket || bucket.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    if (bucket.count >= opts.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests, slow down.' });
      return;
    }

    bucket.count++;
    next();
  };
}
