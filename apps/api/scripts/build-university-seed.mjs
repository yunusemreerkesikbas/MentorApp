/**
 * Turns the ÖSYM preference guides into `seed/universities.seed.json`.
 *
 *   source/2026-osym-lisans.xls  ┐
 *   source/2026-osym-onlisans.xls┘──▶ seed/universities.seed.json  (~207 universities)
 *
 * Run once a year, when ÖSYM publishes the new guide:
 *   pnpm --filter @mentor/api seed:universities
 *
 * The guides are hierarchical reports, not tables. Three row shapes are interleaved and only the
 * first column tells them apart:
 *   university → col A empty, col B ends with "(Devlet|Vakıf Üniversitesi)"
 *   faculty    → col A empty, anything else
 *   program    → col A holds the program code
 *
 * City resolution follows ÖSYM's own convention: the city is given in parentheses ONLY when the
 * university name does not already contain it ("ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)" vs
 * "ADIYAMAN ÜNİVERSİTESİ"). So we read the parenthetical first, then fall back to matching a
 * province name among the name's words. Anything still unresolved is reported, never guessed —
 * an invented city puts a university on the wrong side of the map forever.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import XLSX from "xlsx";
// Shared with import-programs.mjs — both sides of the university join must normalise identically.
import { normalize, slugify } from "./lib/turkish.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(HERE, "../src/modules/content/source");
const SEED_DIR = resolve(HERE, "../src/modules/content/seed");

const FILES = ["2026-osym-lisans.xls", "2026-osym-onlisans.xls"];

const SOURCE_LABEL = "ÖSYM 2026 Yükseköğretim Programları ve Kontenjanları Kılavuzu";
const SOURCE_URL = "https://www.osym.gov.tr";

/**
 * Header rows that carry the university type suffix but are NOT universities — they are placement
 * categories nested under a university that already appears on its own. Left in, they would each
 * become a phantom extra pin on the map.
 *
 * Value = the real university this category belongs to (used when programs are imported later).
 */
const NOT_A_UNIVERSITY = new Map([
  [
    "İÇİŞLERİ BAKANLIĞI VE MİLLİ SAVUNMA BAKANLIĞI ADINA SAĞLIK BİLİMLERİ ÜNİVERSİTESİNDE EĞİTİM ALACAKLAR",
    "SAĞLIK BİLİMLERİ ÜNİVERSİTESİ",
  ],
]);

/**
 * Universities whose city neither appears in parentheses nor matches a province name in the title.
 * Each entry is a deliberate editorial decision, not a guess — extend it when the reporter below
 * prints a new name.
 */
const CITY_OVERRIDES = new Map([
  // Gebze is a district of Kocaeli; the guide names the district, not the province.
  ["GEBZE TEKNİK ÜNİVERSİTESİ", "41"],
  // Ankara (Oran campus) — confirmed against the university's own site, tju.edu.tr.
  ["TÜRK-JAPON BİLİM VE TEKNOLOJİ ÜNİVERSİTESİ", "06"],
]);


function readUniversityHeaders() {
  const seen = new Map();

  for (const file of FILES) {
    const workbook = XLSX.readFile(resolve(SOURCE_DIR, file));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: null,
    });

    for (const row of rows) {
      if (row[0] || !row[1]) continue; // program row, or blank

      const text = String(row[1]).trim();
      const typed = text.match(/^(.*?)\s*\((Devlet|Vak[ıi]f)\s+Üniversitesi\)\s*$/i);
      if (!typed) continue; // faculty header

      let name = typed[1].trim();
      const kind = /vak/i.test(typed[2]) ? "FOUNDATION" : "STATE";

      let cityHint = null;
      const parenthetical = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (parenthetical) {
        name = parenthetical[1].trim();
        cityHint = parenthetical[2].trim();
      }

      if (NOT_A_UNIVERSITY.has(name)) continue;
      if (!seen.has(name)) seen.set(name, { name, kind, cityHint });
    }
  }

  return [...seen.values()];
}

function main() {
  const { cities } = JSON.parse(
    readFileSync(resolve(SEED_DIR, "cities.seed.json"), "utf8"),
  );
  const codeByName = new Map(cities.map((c) => [normalize(c.name), c.code]));

  const universities = [];
  const unresolved = [];

  for (const uni of readUniversityHeaders()) {
    let cityCode = CITY_OVERRIDES.get(uni.name) ?? null;

    if (!cityCode && uni.cityHint) {
      cityCode = codeByName.get(normalize(uni.cityHint)) ?? null;
    }
    if (!cityCode) {
      // Province names are all single words, so word-level matching avoids the substring traps
      // ("KARS" inside "KARSIYAKA", "VAN" inside "VANLI").
      for (const word of normalize(uni.name).split(" ")) {
        const code = codeByName.get(word);
        if (code) {
          cityCode = code;
          break;
        }
      }
    }

    if (!cityCode) {
      unresolved.push(uni.name);
      continue;
    }

    universities.push({
      cityCode,
      name: uni.name,
      slug: slugify(uni.name),
      kind: uni.kind,
      foundedYear: null, // the guide does not state it — left null rather than invented
      websiteUrl: null,
      latitude: null, // filled by scripts/geocode-universities.mjs
      longitude: null,
    });
  }

  universities.sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const slugs = new Set(universities.map((u) => u.slug));
  assert.equal(
    slugs.size,
    universities.length,
    "Duplicate university slug — two universities normalised to the same key.",
  );

  if (unresolved.length > 0) {
    console.error(
      `\n${unresolved.length} university(ies) have no resolvable city. Add each to CITY_OVERRIDES after checking where it actually is:\n` +
        unresolved.map((n) => `  - ${n}`).join("\n") +
        "\n",
    );
  }

  // Preserve any coordinates already geocoded, so re-importing a new guide does not throw away
  // ~207 Nominatim lookups.
  const seedPath = resolve(SEED_DIR, "universities.seed.json");
  let previous = new Map();
  try {
    const old = JSON.parse(readFileSync(seedPath, "utf8"));
    previous = new Map(
      (old.universities ?? [])
        .filter((u) => u.latitude != null)
        .map((u) => [u.slug, u]),
    );
  } catch {
    /* first run */
  }
  for (const uni of universities) {
    const prior = previous.get(uni.slug);
    if (prior) {
      uni.latitude = prior.latitude;
      uni.longitude = prior.longitude;
    }
  }

  writeFileSync(
    seedPath,
    `${JSON.stringify(
      {
        note: "AUTO-GENERATED by scripts/build-university-seed.mjs from the ÖSYM guides under src/modules/content/source/. Do not edit by hand — re-run the script instead. Coordinates come from scripts/geocode-universities.mjs and are preserved across re-imports.",
        source: SOURCE_LABEL,
        sourceUrl: SOURCE_URL,
        verifiedAt: new Date().toISOString(),
        universities,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const withCoords = universities.filter((u) => u.latitude != null).length;
  console.log(
    `${universities.length} universities → ${seedPath}\n` +
      `  state: ${universities.filter((u) => u.kind === "STATE").length}, foundation: ${universities.filter((u) => u.kind === "FOUNDATION").length}\n` +
      `  with coordinates: ${withCoords} (run seed:geocode for the rest)\n` +
      `  unresolved city: ${unresolved.length}`,
  );
}

main();
