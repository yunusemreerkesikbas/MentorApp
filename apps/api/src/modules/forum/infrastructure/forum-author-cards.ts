import { inArray } from "drizzle-orm";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { users } from "../../../database/schema";

interface AuthorFields {
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarStorageKey: string | null;
}

/**
 * Fills in the author's public face (name, handle, avatar) on rows read in user context.
 *
 * The `users` policy lets a session read only its own row, so the user-context `users` join in
 * these queries yields nothing for anyone else: blank names, a "Kullanıcı" placeholder for every
 * other author in production. Superuser connections skip RLS, which is why dev and CI never
 * showed it. The rows themselves keep their user-context visibility; only these three public
 * columns are read as SERVICE, the same fields the discovery feed already returns.
 */
export async function withAuthorCards<T extends AuthorFields>(db: Database, rows: T[]): Promise<T[]> {
  const ids = [...new Set(rows.map((row) => row.authorId))];
  if (ids.length === 0) return rows;
  const cards = await withServiceContext(db, (tx) =>
    tx
      .select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        avatarStorageKey: users.avatarStorageKey,
      })
      .from(users)
      .where(inArray(users.id, ids)),
  );
  const byId = new Map(cards.map((card) => [card.id, card]));
  return rows.map((row) => {
    const card = byId.get(row.authorId);
    return card
      ? {
          ...row,
          authorName: card.displayName ?? "",
          authorUsername: card.username,
          authorAvatarStorageKey: card.avatarStorageKey,
        }
      : row;
  });
}

export async function withAuthorCard<T extends AuthorFields>(db: Database, row: T | null): Promise<T | null> {
  return row ? (await withAuthorCards(db, [row]))[0]! : null;
}
