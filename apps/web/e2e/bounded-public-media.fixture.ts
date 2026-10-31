import { randomUUID } from "node:crypto";
import { createPool } from "../../api/src/database/drizzle";
import { assertLocalTestDatabase } from "../../api/test/database-target";

/** Only an explicit loopback _test DB; never an app .env or hosted database. */
export async function seedPublicMediaArticle() {
  const target = process.env.TEST_DATABASE_URL;
  if (!target)
    throw new Error(
      "Explicit TEST_DATABASE_URL is required for bounded media acceptance.",
    );
  assertLocalTestDatabase(target);
  const pool = createPool(target);
  const id = randomUUID();
  const slug = `bounded-media-${id}`;
  try {
    await pool.query(
      `insert into info_articles(id,slug,title,body,family,category,source,source_url,verified_at,verified_by,published_at,
      cover_image_key,cover_image_alt,cover_image_width,cover_image_height)
      values ($1,$2,'Media fixture','Synthetic media body','KPSS','GENERAL','Test fixture','https://example.test',now(),'fixture',now(),$3,'Fixture cover',100,100)`,
      [id, slug, `content/articles/cover/${id}.png`],
    );
    return {
      slug,
      cleanup: async () => {
        try {
          await pool.query("delete from info_articles where id=$1", [id]);
        } finally {
          await pool.end();
        }
      },
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
