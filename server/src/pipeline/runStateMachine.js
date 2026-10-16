import { canTransition, isTerminal } from '@fyp/shared';
import { AppError } from '../errors.js';

/** Pure function: returns a new record or throws. All status changes in the system go through here. */
export function transition(run, nextStatus, patch = {}, now = new Date()) {
  if (!canTransition(run.status, nextStatus)) {
    throw new AppError('INVALID_TRANSITION', `Cannot move run from ${run.status} to ${nextStatus}`, 409);
  }
  return { ...run, ...patch, status: nextStatus, updated_at: now.toISOString() };
}

export { isTerminal };
