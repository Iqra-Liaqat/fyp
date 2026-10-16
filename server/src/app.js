import express from 'express';
import cors from 'cors';
import { createRoutes, errorHandlers, DEFAULT_DEMOS_PATH } from './api/routes.js';

export function createApp({ config, store, bus, orchestrator, workspace, demosPath = DEFAULT_DEMOS_PATH }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.DASHBOARD_ORIGIN }));
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', createRoutes({ config, store, bus, orchestrator, workspace, demosPath }));
  const { notFound, onError } = errorHandlers();
  app.use(notFound);
  app.use(onError);
  return app;
}
