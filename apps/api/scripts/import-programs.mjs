/**
 * Imports ÖSYM programs straight into `programs` + `program_scores`.
 *
 *   pnpm --filter @mentor/api seed:programs
 *
 * Unlike cities/universities there is NO seed JSON here, and this does not run on boot: ~21.5k
 * programs would mean an ~8MB file parsed and re-upserted on every single API start, for data a
 * human imports once a year. The committed `.xls` files are the source of truth; this script is
 * the (repeatable) step that loads them.
 *
 * The two guides are hierarchical reports — university / faculty / program rows interleaved, told
 * apart only by the first column — so parsing is stateful: carry the current university and
 * faculty down onto each program row.
 *
 * A row carries TWO different years, which is the easiest thing to get wrong here:
 *   GENEL KONT.              → seats offered in the guide's own year (2026)  → programs.quota
 *   2025-YKS SIRASI / PUANI  → last year's placement result                 → program_scores(2025)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { Pool } from "pg";
import { normalize, slugify } from "./lib/turkish.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(HERE, "../src/modules/content/source");

const GUIDE_YEAR = 2026;
const SCORE_YEAR = 2025;
const SOURCE_LABEL = "ÖSYM 2026 Yükseköğretim Programları ve Kontenjanları Kılavuzu";
const SOURCE_URL = "https://www.osym.gov.tr";

const FILES = [
  { file: "2026-osym-lisans.xls", level: "LISANS" },
  { file: "2026-osym-onlisans.xls", level: "ONLISANS" },
];

/** Placement-category headers that are not universities; value = the university they belong to. */
const NOT_A_UNIVERSITY = new Map([
  [
    "İÇİŞLERİ BAKANLIĞI VE MİLLİ SAVUNMA BAKANLIĞI ADINA SAĞLIK BİLİMLERİ ÜNİVERSİTESİNDE EĞİTİM ALACAKLAR",
    "SAĞLIK BİLİMLERİ ÜNİVERSİTESİ",
  ],
]);

/** Rows inserted per statement — keeps array parameters and server memory comfortable. */
const CHUNK = 4000;

/** The guide prints these instead of a number when a program took no placement. */
function toNumber(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (text === "" || /^-+$/.test(text) || text === "...") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function readGuides() {
  const programs = [];
  const unmatchedUniversities = new Set();

  for (const { file, level } of FILES) {
    const workbook = XLSX.readFile(resolve(SOURCE_DIR, file));
    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[workbook.SheetNames[0]],
      { header: 1, raw: false, defval: null },
    );

    let university = null;
    let faculty = null;

    for (const row of rows) {
      const code = row[0] ? String(row[0]).trim() : null;
      const label = row[1] ? String(row[1]).trim() : null;

      if (!code) {
        if (!label) continue;
        const typed = label.match(
          /^(.*?)\s*\((Devlet|Vak[ıi]f)\s+Üniversitesi\)\s*$/i,
        );
        if (typed) {
          let name = typed[1].trim();
          const parenthetical = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
          if (parenthetical) name = parenthetical[1].trim();
          university = NOT_A_UNIVERSITY.get(name) ?? name;
          faculty = null;
        } else {
          faculty = label;
        }
        continue;
      }

      if (!/^\d{9}$/.test(code)) continue; // not a program row
      if (!university || !faculty) {
        unmatchedUniversities.add(`${code} (no university/faculty in scope)`);
        continue;
      }

      programs.push({
        code,
        universitySlug: slugify(university),
        faculty,
        name: label ?? "",
        level,
        durationYears: toNumber(row[2]) ?? 0,
        scoreType: String(row[3] ?? "").trim(),
        quota: toNumber(row[4]) ?? 0,
        successRank: toNumber(row[5]),
        minScore: toNumber(row[6]),
      });
    }
  }

  assert.deepEqual([...unmatchedUniversities], [], "Program rows outside any university scope");
  return programs;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const parsed = readGuides();
    console.log(`Parsed ${parsed.length} programs from ${FILES.length} guides.`);

    const { rows: universities } = await client.query(
      "SELECT id, slug FROM universities",
    );
    const idBySlug = new Map(universities.map((u) => [u.slug, u.id]));

    const missing = new Map();
    const programs = [];
    for (const p of parsed) {
      const universityId = idBySlug.get(p.universitySlug);
      if (!universityId) {
        missing.set(p.universitySlug, (missing.get(p.universitySlug) ?? 0) + 1);
        continue;
      }
      programs.push({ ...p, universityId });
    }

    if (missing.size > 0) {
      console.error(
        `\n${missing.size} university slug(s) in the guides have no row in \`universities\` — run seed:universities first:\n` +
          [...missing].map(([slug, n]) => `  - ${slug} (${n} programs)`).join("\n") +
          "\n",
      );
    }

    await client.query("BEGIN");
    // Explicit SERVICE role: the tables FORCE row-level security, and relying on a superuser
    // bypassing it locally would mean this script fails the first time it runs against Neon.
    await client.query("SET LOCAL app.role = 'SERVICE'");

    let written = 0;
    for (let i = 0; i < programs.length; i += CHUNK) {
      const chunk = programs.slice(i, i + CHUNK);
      await client.query(
        `INSERT INTO programs
           (code, university_id, faculty, name, level, duration_years, score_type, quota,
            guide_year, source, source_url, verified_at)
         SELECT * FROM UNNEST(
           $1::varchar[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::smallint[],
           $7::text[], $8::integer[], $9::smallint[], $10::text[], $11::text[], $12::timestamptz[])
         ON CONFLICT (code) DO UPDATE SET
           university_id = EXCLUDED.university_id, faculty = EXCLUDED.faculty,
           name = EXCLUDED.name, level = EXCLUDED.level,
           duration_years = EXCLUDED.duration_years, score_type = EXCLUDED.score_type,
           quota = EXCLUDED.quota, guide_year = EXCLUDED.guide_year,
           source = EXCLUDED.source, source_url = EXCLUDED.source_url,
           verified_at = EXCLUDED.verified_at, updated_at = now()`,
        [
          chunk.map((p) => p.code),
          chunk.map((p) => p.universityId),
          chunk.map((p) => p.faculty),
          chunk.map((p) => p.name),
          chunk.map((p) => p.level),
          chunk.map((p) => p.durationYears),
          chunk.map((p) => p.scoreType),
          chunk.map((p) => p.quota),
          chunk.map(() => GUIDE_YEAR),
          chunk.map(() => SOURCE_LABEL),
          chunk.map(() => SOURCE_URL),
          chunk.map(() => new Date()),
        ],
      );

      await client.query(
        `INSERT INTO program_scores (program_code, score_year, min_score, success_rank)
         SELECT * FROM UNNEST($1::varchar[], $2::smallint[], $3::numeric[], $4::integer[])
         ON CONFLICT (program_code, score_year) DO UPDATE SET
           min_score = EXCLUDED.min_score, success_rank = EXCLUDED.success_rank,
           updated_at = now()`,
        [
          chunk.map((p) => p.code),
          chunk.map(() => SCORE_YEAR),
          chunk.map((p) => p.minScore),
          chunk.map((p) => p.successRank),
        ],
      );

      written += chunk.length;
      console.log(`  ${written}/${programs.length}…`);
    }

    await client.query("COMMIT");

    const { rows: summary } = await client.query(
      `SELECT p.level,
              count(*)::int                              AS total,
              count(s.min_score)::int                    AS with_score,
              count(DISTINCT p.university_id)::int       AS universities
         FROM programs p
         LEFT JOIN program_scores s
           ON s.program_code = p.code AND s.score_year = $1
        GROUP BY p.level ORDER BY p.level`,
      [SCORE_YEAR],
    );
    console.log("");
    for (const r of summary) {
      console.log(
        `${r.level}: ${r.total} programs · ${r.with_score} with a ${SCORE_YEAR} cutoff · ${r.universities} universities`,
      );
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
