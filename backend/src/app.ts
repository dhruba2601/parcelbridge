import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { openApiSpec } from './docs/openapi';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { customerRouter } from './routes/customer';
import { deliveryRouter } from './routes/delivery';
import { healthRouter } from './routes/health';
import { parcelsRouter } from './routes/parcels';
import { partnersRouter } from './routes/partners';
import { schedulingRouter } from './routes/scheduling';
import { webhooksRouter } from './routes/webhooks';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = env.frontendUrl.split(',').map((s) => s.trim());
        if (allowed.includes(origin) || !env.isProd) {
          return callback(null, true);
        }
        return callback(new Error('CORS origin not allowed'));
      },
      credentials: true,
    })
  );

  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  if (env.nodeEnv !== 'test') {
    app.use(morgan('combined'));
  }
  app.use('/api', apiRateLimiter);

  // OpenAPI / Swagger Docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiSpec));

  // Versioned REST API
  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/parcels', parcelsRouter);
  app.use('/api/v1', schedulingRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/delivery', deliveryRouter);
  app.use('/api/v1/partners', partnersRouter);
  app.use('/api/v1/customer', customerRouter);
  app.use('/api/v1/webhooks', webhooksRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found', code: 'ROUTE_NOT_FOUND' });
  });

  app.use(errorHandler);
  return app;
}
