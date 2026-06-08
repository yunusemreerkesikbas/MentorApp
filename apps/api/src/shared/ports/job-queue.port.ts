/**
 * Queue port (§7/§8 Ports & Adapters).
 *
 * Heavy/async work (LLM analysis, notifications, embeddings, reflection loop, scheduled check-ins)
 * is not kept synchronous → it goes to the queue. Jobs are **latency-tolerant** (don't block the user).
 *
 * Adapter phasing (the domain calls this port, the adapter changes → code stays):
 *  - **MVP:** Render Cron + a `jobs` table (status/attempts/run_at). Neon scale-to-zero is preserved
 *    (NO continuous polling) → ~$0 in the early/seasonal-trough phase.
 *  - **Phase 2:** BullMQ + Redis (Redis already arrives with presence/leaderboard; real-scale throughput).
 */
export const JOB_QUEUE_PORT = Symbol("JOB_QUEUE_PORT");

export interface EnqueueOptions {
  /** Earliest run time (for scheduled jobs). */
  runAt?: Date;
  /** Max attempts (handler must be idempotent). */
  maxAttempts?: number;
}

export interface JobQueuePort {
  /** Enqueue a job. `name` selects the handler; `payload` must be JSON-serializable. */
  enqueue<T>(name: string, payload: T, options?: EnqueueOptions): Promise<{ jobId: string }>;
}
