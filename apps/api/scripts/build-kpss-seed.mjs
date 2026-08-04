/**
 * Turns the ÖSYM KPSS placement guides into one `seed/kpss.<round>.seed.json` file per round.
 *
 *   source/<round>-{lisans,onlisans,ortaogretim}-kpss.xlsx  ──▶  seed/kpss.<round>.seed.json
 *   e.g. source/2026-1-lisans-kpss.xlsx                     ──▶  seed/kpss.2026-1.seed.json
 *
 * Rounds are DISCOVERED from the directory, not listed in code: publishing a new guide is dropping
 * three files in, and every round already imported keeps its own seed file untouched.
 *
 * Run when a new placement round is published:
 *   pnpm --filter @mentor/api seed:kpss
 *
 * Produces three lists:
 *   titles       — civil-service job names (the goal anchor; stable across rounds)
 *   institutions — whoever posted in THIS round (a snapshot, never a full catalogue)
 *   postings     — the (institution × title × province) rows, tagged with the round
 *
 * Columns are resolved BY HEADER NAME, never by position. The three guides do not share a layout:
 * the önlisans sheet carries an extra "BİRİM ADI" column, which shifts everything after it — so a
 * fixed index that reads ADET in two files reads DERECE in the third, silently.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { normalize, slugify } from "./lib/turkish.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(HERE, "../src/modules/content/source");
const SEED_DIR = resolve(HERE, "../src/modules/content/seed");

const SOURCE_URL = "https://www.osym.gov.tr";

/** `2026-1-onlisans-kpss.xlsx` → round "2026-1", level ONLISANS. */
const GUIDE_FILE = /^(\d{4}-\d+)-(lisans|onlisans|ortaogretim)-kpss\.xlsx$/i;
const LEVEL_BY_SLUG = {
  lisans: "LISANS",
  onlisans: "ONLISANS",
  ortaogretim: "ORTAOGRETIM",
};

/** "2026-1" → 20261, so editions sort numerically rather than as text ("2026-10" < "2026-2"). */
function periodSortKey(round) {
  const [year, index] = round.split("-");
  return Number(year) * 10 + Number(index);
}

/**
 * Shown beside the data in the app, so the numbers never read as a standing state of the world.
 * Written per round rather than templated at render time — each edition explains its own scope,
 * and a later one can say something different without a code change.
 */
function describe(round) {
  const label = round.replace("-", "/");
  return {
    descriptionTr: `Kadro ve pozisyon bilgileri ÖSYM'den alınır. ${label} atama dönemini kapsar; her dönemde ilanlar tamamen değişir.`,
    descriptionEn: `Vacancy data comes from ÖSYM and covers the ${label} placement round; every round replaces the previous one entirely.`,
  };
}

/** Groups the guide files in `source/` by round. Missing levels are an error, not a silent gap. */
function discoverRounds() {
  const byRound = new Map();
  for (const file of readdirSync(SOURCE_DIR)) {
    const match = GUIDE_FILE.exec(file);
    if (!match) continue;
    const [, round, levelSlug] = match;
    const list = byRound.get(round) ?? [];
    list.push({ file, level: LEVEL_BY_SLUG[levelSlug.toLowerCase()] });
    byRound.set(round, list);
  }

  const rounds = [...byRound.entries()]
    .map(([round, files]) => ({ round, files }))
    .sort((a, b) => periodSortKey(a.round) - periodSortKey(b.round));

  assert(rounds.length > 0, `No KPSS guides found in ${SOURCE_DIR}.`);
  for (const { round, files } of rounds) {
    const levels = new Set(files.map((f) => f.level));
    assert.deepEqual(
      [...levels].sort(),
      ["LISANS", "ONLISANS", "ORTAOGRETIM"],
      // A round missing a level would import as a smaller round and look like an ÖSYM decision.
      `Round ${round} is missing a guide — expected all three education levels, got ${[...levels].join(", ")}.`,
    );
  }
  return rounds;
}

/**
 * Collapses internal whitespace, not just the ends.
 *
 * The guides wrap long cells with a literal CRLF, and the break lands wherever the column happened
 * to be narrow: "KORUMA VE GÜVENLİK\r\nGÖREVLİSİ" and "KORUMA VE\r\nGÜVENLİK GÖREVLİSİ" are the
 * same job. A plain `trim()` keeps both, which yields two rows for one title and a name that
 * renders with a line break inside it.
 */
const cleanText = (value) =>
  value == null ? null : String(value).replace(/\s+/g, " ").trim() || null;

/** Header text → canonical key, tolerant of the embedded newlines ("HİZMET\r\nSINIFI"). */
const headerKey = (value) => (cleanText(value) ?? "").toUpperCase();

function toNumber(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (text === "" || /^-+$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function readGuide(file, level, codeBySlug) {
  const workbook = XLSX.readFile(resolve(SOURCE_DIR, file));
  const rows = XLSX.utils.sheet_to_json(
    workbook.Sheets[workbook.SheetNames[0]],
    { header: 1, raw: false, defval: null },
  );

  // Row 0 is the merged "ARANAN NİTELİKLER" banner; row 1 holds the real headers.
  const header = (rows[1] ?? []).map(headerKey);
  const at = (name) => header.indexOf(name);
  const col = {
    code: at("ÖSYM KODU"),
    institution: at("KURUM ADI"),
    employment: at("İSTİHDAM ŞEKLİ"),
    // "KADRO-ÜNVANI" in the lisans guide, "KADRO-ÜNVAN" in the other two.
    title: header.findIndex((h) => h.startsWith("KADRO-ÜNVAN")),
    city: at("İL"),
    district: at("İLÇE"),
    // "HİZMET SINIFI" in the 2026/1 guides, plain "SINIFI" in the 2025/2 ones. Matched by suffix
    // rather than exact text, because the assert below would otherwise reject a valid guide.
    serviceClass: header.findIndex((h) => h.endsWith("SINIFI")),
    grade: at("DERECE"),
    quota: at("ADET"),
  };

  for (const [name, index] of Object.entries(col)) {
    assert(index >= 0, `${file}: missing column "${name}" — header was ${header.join(" | ")}`);
  }

  const postings = [];
  const unknownCities = new Set();

  for (const row of rows.slice(2)) {
    const code = row[col.code] ? String(row[col.code]).trim() : null;
    if (!code || !/^\d+$/.test(code)) continue;

    const cityName = row[col.city];
    const cityCode = codeBySlug.get(slugify(cityName));
    if (!cityCode) {
      unknownCities.add(String(cityName));
      continue;
    }

    postings.push({
      osymCode: code,
      educationLevel: level,
      // Slugs, not names: the seed file is the join, and the slug rule lives here only.
      institutionSlug: slugify(cleanText(row[col.institution])),
      titleSlug: slugify(cleanText(row[col.title])),
      institutionName: cleanText(row[col.institution]),
      titleName: cleanText(row[col.title]),
      cityCode,
      district: cleanText(row[col.district]),
      employmentType: cleanText(row[col.employment]) ?? "",
      serviceClass: cleanText(row[col.serviceClass]),
      grade: toNumber(row[col.grade]),
      quota: toNumber(row[col.quota]) ?? 0,
    });
  }

  assert.deepEqual(
    [...unknownCities],
    [],
    `${file}: province names with no match in cities.seed.json`,
  );
  return postings;
}

function buildRound({ round, files }, codeBySlug) {
  const postings = files.flatMap(({ file, level }) =>
    readGuide(file, level, codeBySlug),
  );

  assert(postings.length > 0, `Round ${round}: no postings parsed — check the source files.`);
  assert.equal(
    new Set(postings.map((p) => p.osymCode)).size,
    postings.length,
    // Within a round the ÖSYM code is the identity; across rounds it may legitimately repeat,
    // which is exactly why the table keys on (dataset, code) rather than the code alone.
    `Round ${round}: duplicate ÖSYM code across guides.`,
  );

  // Names → the two reference lists. Sorted so a re-import produces a stable diff.
  const byName = (key) =>
    [...new Set(postings.map((p) => p[key]))]
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((name) => ({ name, slug: slugify(name) }));

  const titles = byName("titleName");
  const institutions = byName("institutionName");

  for (const [label, list] of [["title", titles], ["institution", institutions]]) {
    assert.equal(
      new Set(list.map((x) => x.slug)).size,
      list.length,
      `Round ${round}: two ${label}s normalise to the same slug — the slug is the join key.`,
    );
  }

  const seedFile = `kpss.${round}.seed.json`;
  writeFileSync(
    resolve(SEED_DIR, seedFile),
    `${JSON.stringify(
      {
        note: "AUTO-GENERATED by scripts/build-kpss-seed.mjs from the ÖSYM KPSS guides under src/modules/content/source/. Do not edit by hand. `institutions` is whoever posted in this round, NOT a catalogue of Turkish public bodies — which is why the UI treats it as an optional filter and always shows the round.",
        round,
        ...describe(round),
        source: `ÖSYM KPSS-${round.replace("-", "/")} Tercih Kılavuzu`,
        sourceUrl: SOURCE_URL,
        verifiedAt: new Date().toISOString(),
        titles,
        institutions,
        postings,
      },
      null,
      2,
    )}
`,
    "utf8",
  );

  const quota = postings.reduce((sum, p) => sum + p.quota, 0);
  const byLevel = {};
  for (const p of postings) byLevel[p.educationLevel] = (byLevel[p.educationLevel] ?? 0) + 1;

  console.log(
    `${round}: ${postings.length} postings · ${quota} positions · ${titles.length} titles · ${institutions.length} institutions
` +
      `  ${Object.entries(byLevel).map(([k, v]) => `${k}: ${v}`).join(" · ")}
` +
      `  → ${seedFile}`,
  );
  return { round, postings: postings.length, quota };
}

function main() {
  const { cities } = JSON.parse(
    readFileSync(resolve(SEED_DIR, "cities.seed.json"), "utf8"),
  );
  const codeBySlug = new Map(cities.map((c) => [c.slug, c.code]));

  const rounds = discoverRounds();
  const built = rounds.map((r) => buildRound(r, codeBySlug));

  console.log(
    `
${built.length} round(s) written; newest (${built.at(-1).round}) becomes current on seed.`,
  );
}

main();
