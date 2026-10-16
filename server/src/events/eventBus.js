import { EventEmitter } from 'node:events';

/** In-process pub/sub, one channel per run. Events are persisted through `persist` so history survives restarts. */
export function createEventBus({ persist } = {}) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100);
  const seqByRun = new Map();

  async function publish(runId, partial) {
    const seq = (seqByRun.get(runId) ?? 0) + 1;
    seqByRun.set(runId, seq);
    const event = { run_id: runId, seq, ts: new Date().toISOString(), ...partial };
    if (persist) {
      try {
        await persist(runId, event);
      } catch {
        /* event persistence is best-effort; never break a run because of it */
      }
    }
    emitter.emit(runId, event);
    return event;
  }

  function subscribe(runId, listener) {
    emitter.on(runId, listener);
    return () => emitter.off(runId, listener);
  }

  return { publish, subscribe };
}
