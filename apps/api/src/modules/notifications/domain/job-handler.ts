/** Handler function registered by name on the job runner. Must be idempotent. */
export type JobHandler = (payload: unknown) => Promise<void>;
