
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { createRoutes, errorHandlers, DEFAULT_DEMOS_PATH } from './api/routes.js';
import { createPreviewServer } from './preview/previewServer.js';

export function createApp({ config, store, bus, orchestrator, workspace, demosPath = DEFAULT_DEMOS_PATH }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.DASHBOARD_ORIGIN }));
  app.use(express.json({ limit: '256kb' }));

  app.use('/api', createRoutes({ config, store, bus, orchestrator, workspace, demosPath }));

  // Serve generated MVP previews through the same public port.
  app.use(createPreviewServer({ config }));

  // Serve the built React dashboard.
  const dashboardDir = path.join(config.rootDir, 'dashboard', 'dist');
  app.use(express.static(dashboardDir));

  // Let the dashboard handle frontend routes.
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/') ||
        req.path === '/preview' || req.path.startsWith('/preview/')) {
      return next();
    }
    res.sendFile(path.join(dashboardDir, 'index.html'));
  });

  const { notFound, onError } = errorHandlers();
  app.use(notFound);
  app.use(onError);

  return app;
}
