import { sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "./drizzle";

export interface UserContext {
  userId: string;
  orgId?: string | null;
  role?: string | null;
}

/**
 * Runs `fn` inside a transaction with request-scoped Postgres GUCs so RLS policies
 * can read `current_setting('app.user_id')` etc. `SET LOCAL` (via set_config 3rd arg = true)
 * is transaction-scoped, so it never leaks to other pooled connections.
 *
 * RLS policies themselves are created with the identity module (Step 2); this helper is the
 * single entry point every tenant-scoped write/read will use.
 */
export async function withUserContext<T>(
  db: Database,
  ctx: UserContext,
  fn: (tx: DatabaseTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true)`);
    await tx.execute(sql`select set_config('app.org_id', ${ctx.orgId ?? ""}, true)`);
    await tx.execute(sql`select set_config('app.role', ${ctx.role ?? ""}, true)`);
    return fn(tx);
  });
}

/**
 * Pre-auth / trusted service paths (login, signup, token flows) — there is no user yet,
 * so RLS policies allow `app.role = 'SERVICE'`. Use ONLY from application services that
 * are themselves the auth boundary; never expose as a request-level default.
 */
export async function withServiceContext<T>(
  db: Database,
  fn: (tx: DatabaseTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.role', 'SERVICE', true)`);
    return fn(tx);
  });
}
