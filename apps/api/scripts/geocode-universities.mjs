/**
 * Fills `latitude`/`longitude` on `seed/universities.seed.json` from OpenStreetMap.
 *
 *   pnpm --filter @mentor/api seed:geocode
 *
 * Run once, after `seed:universities`. Coordinates are written into the seed and committed, so the
 * app never geocodes at runtime — this is an editorial import step, not a dependency.
 *
 * Two properties matter here:
 *
 *  - **Resumable.** Entries that already have coordinates are skipped, and progress is flushed
 *    periodically, so an interrupted run (or a new guide import) repeats at most a few lookups.
 *    Flushing on *every* hit was the first attempt and it deadlocked against the `nest --watch`
 *    file watcher on Windows — 200 rewrites of the same file in as many seconds.
 *  - **Verified, not trusted.** Nominatim happily returns *something* for almost any query. Each
 *    result is only accepted if the province it reports matches the province ÖSYM listed. A
 *    mismatch is reported and left null — a university with no pin is fine, a university pinned in
 *    the wrong city is not.
 *
 * Respects the Nominatim usage policy: one request per second, descriptive User-Agent.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = resolve(HERE, "../src/modules/content/seed");
const SEED_PATH = resolve(SEED_DIR, "universities.seed.json");

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MentorApp/1.0 (one-off university geocoding for an exam-prep app)";
/** Nominatim asks for at most 1 req/s; a little headroom keeps us clearly inside it. */
const REQUEST_INTERVAL_MS = 1200;
/** Flush interval — small enough that a crash costs little, large enough to stay off the watcher. */
const FLUSH_EVERY = 20;

const TR_MAP = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u",
};

function normalize(value) {
  return [...String(value ?? "")]
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function lookup(query) {
  const url = `${ENDPOINT}?${new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "tr",
    addressdetails: "1",
  })}`;

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for "${query}"`);
  const [hit] = await res.json();
  return hit ?? null;
}

/**
 * Writes progress, retrying briefly: on Windows a file watcher or indexer can hold the handle for
 * a moment, and losing a whole run to a transient EBUSY would be silly.
 */
function flush(seed) {
  const body = `${JSON.stringify(seed, null, 2)}\n`;
  for (let attempt = 0; ; attempt += 1) {
    try {
      writeFileSync(SEED_PATH, body, "utf8");
      return;
    } catch (err) {
      if (attempt >= 4) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    }
  }
}

/**
 * Query variants, tried in order until one lands in the expected province.
 *
 * The guide spells every name in caps with Turkish diacritics ("VAN YÜZÜNCÜ YIL ÜNİVERSİTESİ"),
 * and Nominatim returns nothing for a good number of those — including large, unambiguous
 * universities, so it is the spelling that fails rather than the place being obscure. Lower-casing
 * and then ASCII-folding recovers them.
 */
function queryVariants(name, cityName) {
  const lower = name.toLocaleLowerCase("tr-TR");
  const ascii = normalize(name);
  return [...new Set([name, lower, ascii])].map((n) => `${n}, ${cityName}`);
}

/** Nominatim reports the province under different keys depending on the place type. */
function provinceOf(hit) {
  const a = hit.address ?? {};
  return a.province ?? a.state ?? a.city ?? a.town ?? null;
}

async function main() {
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));
  const { cities } = JSON.parse(
    readFileSync(resolve(SEED_DIR, "cities.seed.json"), "utf8"),
  );
  const cityNameByCode = new Map(cities.map((c) => [c.code, c.name]));

  const pending = seed.universities.filter((u) => u.latitude == null);
  console.log(
    `${seed.universities.length} universities, ${pending.length} to geocode (~${Math.ceil(
      (pending.length * REQUEST_INTERVAL_MS) / 60000,
    )} min).`,
  );

  const rejected = [];
  let done = 0;

  for (const uni of pending) {
    const cityName = cityNameByCode.get(uni.cityCode);

    let accepted = null;
    let lastReason = "no result";

    for (const query of queryVariants(uni.name, cityName)) {
      await sleep(REQUEST_INTERVAL_MS);

      let hit;
      try {
        hit = await lookup(query);
      } catch (err) {
        lastReason = String(err.message ?? err);
        continue;
      }
      if (!hit) continue;

      const province = provinceOf(hit);
      if (normalize(province) !== normalize(cityName)) {
        lastReason = `OSM says "${province}", guide says "${cityName}"`;
        continue;
      }

      accepted = hit;
      break;
    }

    if (!accepted) {
      rejected.push({ name: uni.name, reason: lastReason });
      continue;
    }

    uni.latitude = Number(accepted.lat).toFixed(6);
    uni.longitude = Number(accepted.lon).toFixed(6);
    done += 1;

    if (done % FLUSH_EVERY === 0) {
      flush(seed);
      console.log(`  ${done}/${pending.length}…`);
    }
  }

  flush(seed);

  const total = seed.universities.filter((u) => u.latitude != null).length;
  console.log(
    `\nGeocoded ${done} this run · ${total}/${seed.universities.length} have coordinates.`,
  );

  if (rejected.length > 0) {
    console.log(
      `\n${rejected.length} left without coordinates (listed, not pinned — re-run to retry):`,
    );
    for (const r of rejected) console.log(`  - ${r.name}: ${r.reason}`);
  }
}

await main();
