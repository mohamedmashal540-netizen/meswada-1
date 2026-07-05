import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      authInfo?: {
        userId: string;
        sessionId?: string;
      };
    }
  }
}