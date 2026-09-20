import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import env from './config/env.js';
import routes from './routes/index.js';
import paymentController from './controllers/paymentController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import AppError from './utils/AppError.js';

export function createApp() {
  const app = express();

  // Behind a proxy (Vercel/Render/Fly) so req.ip and secure cookies work.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.isProduction ? undefined : false,
  }));

  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(AppError.forbidden('Origin not allowed.', 'CORS_REJECTED'));
    },
    credentials: true,
  }));

  app.use(cookieParser());

  /**
   * The webhook needs the raw body for signature verification, so it is
   * mounted before express.json() takes over.
   */
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentController.webhook);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api', apiLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
