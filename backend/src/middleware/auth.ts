import { Request, Response, NextFunction } from 'express';
import authService from '../services/AuthService';
import logger from '../config/logger';

export interface AuthRequest extends Request {
  user?: any;
  userId?: number;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    //  TEMPORARY LOCAL DEVELOPMENT BYPASS 
    // Automatically signs in as User #1 to test the dashboard
    req.user = { id: 1, name: 'Development User', email: 'dev@local.com' };
    req.userId = 1;
    return next(); // Skips validation and moves directly to the API controller
/*
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const token = authHeader.substring(7);
    const user = await authService.validateToken(token);

    req.user = user;
    req.userId = user.id;
    next();
    */
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }
};
