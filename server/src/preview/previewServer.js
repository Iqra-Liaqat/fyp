import express from 'express';
import path from 'node:path';

const ID_PATTERN = /^run_[a-z0-9]+_[a-f0-9]{6}$/;

/**
 * Serves each run's built dist/ as static files on its OWN port (= its own browser origin), so generated apps
 * cannot read the dashboard's storage. A CSP blocks network access and remote assets.
 */
export function createPreviewServer({ config }) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/preview/:id', (req, res, next) => {
    if (!ID_PATTERN.test(req.params.id)) return res.status(404).send('Not found');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'",
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return express.static(path.join(config.workspaceDir, 'runs', req.params.id, 'project', 'dist'))(req, res, next);
  });
  return app;
}
