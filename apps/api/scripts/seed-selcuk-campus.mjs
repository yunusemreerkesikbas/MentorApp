/**
 * Seeds the editorially verified Selcuk University campus pilot.
 *
 * Run from apps/api (or through the workspace filter):
 *   node scripts/seed-selcuk-campus.mjs
 *   node scripts/seed-selcuk-campus.mjs --validate-only
 */
import "dotenv/config";
import assert from "node:assert/strict";

import { Pool } from "pg";

const UNIVERSITY_SLUG = "selcuk-universitesi";
const VERIFIED_AT = "2026-08-08T00:00:00.000Z";

const experience = {
  coverageStatus: "TERRAIN_ONLY",
  renderMode: "HYBRID",
  initialLatitude: 38.024207,
  initialLongitude: 32.505705,
  initialAltitude: 0,
  initialHeading: 70,
  initialTilt: 55,
  initialRange: 1900,
  source: "Selcuk University official campus sources and Konya Metropolitan Municipality",
  sourceUrl: "https://aday.selcuk.edu.tr/home/Kampuste_Yasam",
  verifiedAt: VERIFIED_AT,
};

const pois = [
  {
    slug: "alaeddin-keykubat-main-entrance",
    category: "ENTRANCE",
    titleTr: "Alaeddin Keykubat Yerleşkesi Ana Girişi",
    titleEn: "Alaeddin Keykubat Campus Main Entrance",
    summaryTr:
      "Kampüs turunun başlangıç noktası. Ana giriş, tramvay hattı ve kampüs içi ulaşım bağlantılarına yakındır.",
    summaryEn:
      "The starting point of the campus tour, close to the tram line and campus transport connections.",
    latitude: 38.018479,
    longitude: 32.516638,
    altitude: 0,
    heading: 315,
    tilt: 50,
    range: 800,
    position: 1,
    sourceUrl:
      "https://www.360konya.com/sanal-tur/selcuk-universitesi-kampus-girisi",
  },
  {
    slug: "erol-gungor-library",
    category: "LIBRARY",
    titleTr: "Prof. Dr. Erol Güngör Kütüphanesi",
    titleEn: "Prof. Dr. Erol Gungor Library",
    summaryTr:
      "Kampüsün merkezî çalışma ve araştırma noktalarından biri; basılı ve dijital kaynaklara erişim sağlar.",
    summaryEn:
      "A central study and research destination providing access to print and digital resources.",
    latitude: 38.02418,
    longitude: 32.51196,
    altitude: 0,
    heading: 225,
    tilt: 52,
    range: 700,
    position: 2,
    sourceUrl: "https://aday.selcuk.edu.tr/home/Sosyal_Kulturel_Faaliyetler",
  },
  {
    slug: "sultan-alparslan-cultural-center",
    category: "CULTURE",
    titleTr: "Sultan Alparslan Kültür Merkezi",
    titleEn: "Sultan Alparslan Cultural Center",
    summaryTr:
      "Konferans, gösteri ve öğrenci etkinliklerine ev sahipliği yapan kampüs kültür merkezi.",
    summaryEn:
      "The campus cultural center hosting conferences, performances, and student events.",
    latitude: 38.022881,
    longitude: 32.510546,
    altitude: 0,
    heading: 35,
    tilt: 50,
    range: 650,
    position: 3,
    sourceUrl: "https://www.selcuk.edu.tr/birim/sayfa/5355/personel-iletisim-1224",
  },
  {
    slug: "technology-faculty",
    category: "FACULTY",
    titleTr: "Teknoloji Fakültesi",
    titleEn: "Faculty of Technology",
    summaryTr:
      "Bilgisayar, elektrik-elektronik, makine, mekatronik ve diğer mühendislik programlarının bulunduğu fakülte.",
    summaryEn:
      "Home to computer, electrical-electronics, mechanical, mechatronics, and other engineering programs.",
    latitude: 38.028719,
    longitude: 32.509317,
    altitude: 0,
    heading: 190,
    tilt: 52,
    range: 800,
    position: 4,
    sourceUrl: "https://www.selcuk.edu.tr/birim/sayfa/5348/danisma-kurulu-5058",
  },
  {
    slug: "economics-administrative-sciences-faculty",
    category: "FACULTY",
    titleTr: "İktisadi ve İdari Bilimler Fakültesi",
    titleEn: "Faculty of Economics and Administrative Sciences",
    summaryTr:
      "İktisat, işletme, kamu yönetimi ve ilgili sosyal bilim programlarının kampüsteki akademik merkezi.",
    summaryEn:
      "The campus academic center for economics, business, public administration, and related social sciences.",
    latitude: 38.027584,
    longitude: 32.506478,
    altitude: 0,
    heading: 135,
    tilt: 52,
    range: 750,
    position: 5,
    sourceUrl:
      "https://webadmin.selcuk.edu.tr/uploads/contents/iktisadi_ve_idari_bilimler/icerik/44500/%C4%B0%C4%B0BF%20Fak%C3%BClte%20Telefon%20Rehberi%20%2803.03.2026%29_639081370740355983.pdf",
  },
].map((poi) => ({ ...poi, verifiedAt: VERIFIED_AT }));

function validateSeed() {
  assert.equal(pois.length, 5, "The Selcuk pilot must contain exactly five POIs");
  assert.deepEqual(
    pois.map((poi) => poi.position),
    [1, 2, 3, 4, 5],
    "POI positions must be contiguous",
  );
  assert.equal(new Set(pois.map((poi) => poi.slug)).size, pois.length, "POI slugs must be unique");

  for (const poi of pois) {
    assert.match(poi.sourceUrl, /^https:\/\//, `${poi.slug} needs an HTTPS source`);
    assert.ok(poi.latitude >= -90 && poi.latitude <= 90, `${poi.slug} has an invalid latitude`);
    assert.ok(
      poi.longitude >= -180 && poi.longitude <= 180,
      `${poi.slug} has an invalid longitude`,
    );
    assert.ok(
      poi.range >= 650,
      `${poi.slug} camera is too close for a readable aerial overview`,
    );
  }

  return {
    universitySlug: UNIVERSITY_SLUG,
    coverageStatus: experience.coverageStatus,
    renderMode: experience.renderMode,
    poiCount: pois.length,
    minimumPoiRange: Math.min(...pois.map((poi) => poi.range)),
    positions: pois.map((poi) => poi.position),
    slugs: pois.map((poi) => poi.slug),
  };
}

async function seed() {
  const validation = validateSeed();
  const connectionString = process.env.DATABASE_URL?.trim();
  assert.ok(connectionString, "DATABASE_URL is required");

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const universityResult = await client.query(
      "SELECT id FROM universities WHERE slug = $1 LIMIT 1",
      [UNIVERSITY_SLUG],
    );
    assert.equal(universityResult.rowCount, 1, `University not found: ${UNIVERSITY_SLUG}`);
    const universityId = universityResult.rows[0].id;

    const experienceResult = await client.query(
      `INSERT INTO campus_experiences (
         university_id, coverage_status, render_mode,
         initial_latitude, initial_longitude, initial_altitude,
         initial_heading, initial_tilt, initial_range,
         source, source_url, verified_at, is_enabled
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
       ON CONFLICT (university_id) DO UPDATE SET
         coverage_status = EXCLUDED.coverage_status,
         render_mode = EXCLUDED.render_mode,
         initial_latitude = EXCLUDED.initial_latitude,
         initial_longitude = EXCLUDED.initial_longitude,
         initial_altitude = EXCLUDED.initial_altitude,
         initial_heading = EXCLUDED.initial_heading,
         initial_tilt = EXCLUDED.initial_tilt,
         initial_range = EXCLUDED.initial_range,
         source = EXCLUDED.source,
         source_url = EXCLUDED.source_url,
         verified_at = EXCLUDED.verified_at,
         is_enabled = true
       RETURNING id`,
      [
        universityId,
        experience.coverageStatus,
        experience.renderMode,
        experience.initialLatitude,
        experience.initialLongitude,
        experience.initialAltitude,
        experience.initialHeading,
        experience.initialTilt,
        experience.initialRange,
        experience.source,
        experience.sourceUrl,
        experience.verifiedAt,
      ],
    );
    const experienceId = experienceResult.rows[0].id;

    await client.query("DELETE FROM campus_pois WHERE campus_experience_id = $1", [experienceId]);

    for (const poi of pois) {
      await client.query(
        `INSERT INTO campus_pois (
           campus_experience_id, slug, category, title_tr, title_en,
           summary_tr, summary_en, latitude, longitude, altitude,
           heading, tilt, range, position, source_url, verified_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          experienceId,
          poi.slug,
          poi.category,
          poi.titleTr,
          poi.titleEn,
          poi.summaryTr,
          poi.summaryEn,
          poi.latitude,
          poi.longitude,
          poi.altitude,
          poi.heading,
          poi.tilt,
          poi.range,
          poi.position,
          poi.sourceUrl,
          poi.verifiedAt,
        ],
      );
    }

    await client.query("COMMIT");
    console.log(`Seeded ${validation.poiCount} Selcuk campus POIs (${experience.renderMode}).`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const validation = validateSeed();

if (process.argv.includes("--validate-only")) {
  process.stdout.write(`${JSON.stringify(validation)}\n`);
} else {
  await seed();
}
