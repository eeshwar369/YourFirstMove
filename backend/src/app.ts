import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import oauthRoutes from './routes/oauth.routes';
import taskRoutes from './routes/task.routes';
import userRoutes from './routes/user.routes';
import analyticsRoutes from './routes/analytics.routes';
import aiRoutes from './routes/ai.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './config/logger';

// Import and initialize OAuth service (this triggers strategy initialization)
import './services/OAuthService';

const app = express();

// Log OAuth configuration status
logger.info('OAuth Configuration:', {
  google: !!process.env.GOOGLE_CLIENT_ID,
  linkedin: !!process.env.LINKEDIN_CLIENT_ID,
  github: !!process.env.GITHUB_CLIENT_ID,
});

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later',
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: (req as any).userId,
    });

    if (duration > 500) {
      logger.warn(`Slow response: ${req.method} ${req.path} took ${duration}ms`);
    }
  });

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes); // OAuth routes
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes); // AI Agent routes

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
