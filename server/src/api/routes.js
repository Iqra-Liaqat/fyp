import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CreateRunRequestSchema,
  EXPERIMENT_CONDITIONS,
  OUT_OF_SCOPE_CATEGORIES,
  SUPPORTED_PROJECT_TYPES,
} from '@fyp/shared';
import { AppError } from '../errors.js';
import { publicConfig } from '../config/env.js';
import { createInitialRunRecord } from '../pipeline/runFactory.js';

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createRoutes({ config, store, bus, orchestrator, workspace, demosPath }) {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.1.0',
      llm: { provider: config.LLM_PROVIDER, configured: config.llmConfigured },
      time: new Date().toISOString(),
    });
  });

  router.get('/config', (_req, res) => {
    res.json({
      ...publicConfig(config),
      supported_project_types: SUPPORTED_PROJECT_TYPES,
      out_of_scope_categories: OUT_OF_SCOPE_CATEGORIES,
      conditions: EXPERIMENT_CONDITIONS,
    });
  });

  router.get(
    '/demos',
    asyncHandler(async (_req, res) => {
      res.json(JSON.parse(await fs.readFile(demosPath, 'utf8')));
    }),
  );

  router.post(
    '/runs',
    asyncHandler(async (req, res) => {
      const parsed = CreateRunRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          'INVALID_REQUEST',
          parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
          400,
        );
      }
      const run = await store.save(createInitialRunRecord(parsed.data));
      await bus.publish(run.id, { type: 'status', status: run.status, message: 'Run created' });
      // Fire-and-forget: progress is observed via SSE, not by holding this request open.
      orchestrator.start(run.id).catch(() => {});
      res.status(201).json({ run });
    }),
  );

  router.get(
    '/runs',
    asyncHandler(async (_req, res) => {
      const runs = await store.list();
      res.json({
        runs: runs.map((r) => ({
          id: r.id,
          created_at: r.created_at,
          status: r.status,
          outcome: r.outcome,
          mode: r.mode,
          condition: r.condition,
          project_name: r.requirements?.project_name ?? null,
        })),
      });
    }),
  );

  router.get(
    '/runs/:id',
    asyncHandler(async (req, res) => {
      res.json({ run: await store.get(req.params.id) });
    }),
  );

  router.get(
    '/runs/:id/files',
    asyncHandler(async (req, res) => {
      await store.get(req.params.id);
      res.json({ files: await workspace.readSources(req.params.id) });
    }),
  );

  // Server-Sent Events: replays past events, then streams live ones.
  router.get(
    '/runs/:id/events',
    asyncHandler(async (req, res) => {
      await store.get(req.params.id); // 404/400 before switching to streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      const send = (event) => res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      let lastSeq = 0;
      const buffered = [];
      let replaying = true;
      const unsubscribe = bus.subscribe(req.params.id, (event) => {
        if (replaying) buffered.push(event);
        else if (event.seq > lastSeq) {
          lastSeq = event.seq;
          send(event);
        }
      });
      for (const event of await store.readEvents(req.params.id)) {
        lastSeq = Math.max(lastSeq, event.seq);
        send(event);
      }
      replaying = false;
      for (const event of buffered) {
        if (event.seq > lastSeq) {
          lastSeq = event.seq;
          send(event);
        }
      }
      const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);
      req.on('close', () => {
        clearInterval(keepAlive);
        unsubscribe();
      });
    }),
  );

  return router;
}

export function errorHandlers() {
  const notFound = (_req, _res, next) => next(new AppError('NOT_FOUND', 'Route not found', 404));
  // eslint-disable-next-line no-unused-vars
  const onError = (err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: { code: err.code ?? 'INTERNAL_ERROR', message: status >= 500 ? 'Internal server error' : err.message } });
  };
  return { notFound, onError };
}

export const DEFAULT_DEMOS_PATH = path.resolve(import.meta.dirname, '../../../demos/scenarios.json');
