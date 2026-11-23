import { sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { notebookPages } from "../../../database/schema";

/** Project only the keys. Pages can contain large ink arrays. */
export async function notebookPageImageKeys(tx: DatabaseTx, userId?: string): Promise<string[]> {
  const rows = await tx.execute<{ key: string }>(sql`
    SELECT DISTINCT item ->> 'storageKey' AS key FROM ${notebookPages},
      jsonb_array_elements(${notebookPages.doc} -> 'items') AS item
    WHERE item ->> 'kind' = 'image'
      AND starts_with(item ->> 'storageKey', 'notebook/' || ${notebookPages.userId}::text || '/page-')
      ${userId ? sql`AND ${notebookPages.userId} = ${userId}` : sql``}
  `);
  return rows.rows.map((row) => row.key);
}
