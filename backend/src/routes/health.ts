import { Router } from 'express';
import { env } from '../config/env';
import { getSupabaseAdmin } from '../config/supabase';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  let database: 'connected' | 'memory' | 'error' = env.storageDriver === 'memory' ? 'memory' : 'connected';

  if (env.storageDriver === 'supabase') {
    try {
      const { error } = await getSupabaseAdmin().from('roles').select('code').limit(1);
      if (error) database = 'error';
    } catch {
      database = 'error';
    }
  }

  const statusCode = database === 'error' ? 503 : 200;
  res.status(statusCode).json({
    status: database === 'error' ? 'degraded' : 'ok',
    service: 'parcelbridge-api',
    version: '1.0.0',
    storageDriver: env.storageDriver,
    database,
    demoMode: env.demoMode,
    timestamp: new Date().toISOString(),
  });
});
