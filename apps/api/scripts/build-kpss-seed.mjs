/**
 * Turns the ÖSYM KPSS placement guides into `seed/kpss.seed.json`.
 *
 *   source/2026-1-{lisans,onlisans,ortaogretim}-kpss.xlsx  ──▶  seed/kpss.seed.json
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
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { normalize, slugify } from "./lib/turkish.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(HERE, "../src/modules/content/source");
const SEED_DIR = resolve(HERE, "../src/modules/content/seed");

const ROUND = "2026-1";
const SOURCE_LABEL = "ÖSYM KPSS-2026/1 Tercih Kılavuzu";
const SOURCE_URL = "https://www.osym.gov.tr";

const FILES = [
  { file: "2026-1-lisans-kpss.xlsx", level: "LISANS" },
  { file: "2026-1-onlisans-kpss.xlsx", level: "ONLISANS" },
  { file: "2026-1-ortaogretim-kpss.xlsx", level: "ORTAOGRETIM" },
];

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
    serviceClass: at("HİZMET SINIFI"),
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
      round: ROUND,
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

function main() {
  const { cities } = JSON.parse(
    readFileSync(resolve(SEED_DIR, "cities.seed.json"), "utf8"),
  );
  const codeBySlug = new Map(cities.map((c) => [c.slug, c.code]));

  const postings = FILES.flatMap(({ file, level }) =>
    readGuide(file, level, codeBySlug),
  );

  assert(postings.length > 0, "No postings parsed — check the source files.");
  assert.equal(
    new Set(postings.map((p) => p.osymCode)).size,
    postings.length,
    "Duplicate ÖSYM code across guides — the code is the primary key.",
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
      `Two ${label}s normalise to the same slug — the slug is the join key.`,
    );
  }

  writeFileSync(
    resolve(SEED_DIR, "kpss.seed.json"),
    `${JSON.stringify(
      {
        note: "AUTO-GENERATED by scripts/build-kpss-seed.mjs from the ÖSYM KPSS guides under src/modules/content/source/. Do not edit by hand. `institutions` is whoever posted in this round, NOT a catalogue of Turkish public bodies — which is why the UI treats it as an optional filter and always shows the round.",
        round: ROUND,
        source: SOURCE_LABEL,
        sourceUrl: SOURCE_URL,
        verifiedAt: new Date().toISOString(),
        titles,
        institutions,
        postings,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const quota = postings.reduce((sum, p) => sum + p.quota, 0);
  const byLevel = {};
  for (const p of postings) byLevel[p.educationLevel] = (byLevel[p.educationLevel] ?? 0) + 1;

  console.log(
    `${postings.length} postings · ${quota} positions · ${titles.length} titles · ${institutions.length} institutions\n` +
      `  ${Object.entries(byLevel).map(([k, v]) => `${k}: ${v}`).join(" · ")}\n` +
      `  → ${resolve(SEED_DIR, "kpss.seed.json")}`,
  );
}

main();
