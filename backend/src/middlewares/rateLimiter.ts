import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiter for AI endpoints.
 *
 * AI calls cost real money (OpenAI usage), so they're limited per
 * authenticated user (falls back to IP if, for any reason, auth info
 * isn't attached yet) rather than globally — one heavy user shouldn't
 * be able to lock everyone else out.
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 AI requests per user per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.authInfo!.userId || req.ip || 'unknown';
  },
  message: {
    error: 'Too many AI requests',
    message: 'You have exceeded the AI request limit. Please wait a moment and try again.',
  },
});
