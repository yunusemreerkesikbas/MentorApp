/**
 * Dev-only analysis demo seed.
 *
 * Run: pnpm --filter @mentor/api seed:analysis-demo -- --email=user@example.com
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  computeSubjectNet,
  computeTotalNet,
  formatNet,
  type NetRule,
  type SubjectScoreInput,
} from "../src/modules/coaching/domain/net";

const SUBJECTS = [
  "turkce",
  "matematik",
  "tarih",
  "cografya",
  "vatandaslik",
  "guncel",
] as const;

const ATTEMPTS: SubjectScoreInput[][] = [
  [
    [18, 6, 6],
    [12, 6, 12],
    [14, 7, 6],
    [10, 4, 4],
    [5, 2, 2],
    [3, 1, 2],
  ],
  [
    [19, 5, 6],
    [14, 5, 11],
    [15, 6, 6],
    [11, 3, 4],
    [6, 1, 2],
    [3, 1, 2],
  ],
  [
    [20, 5, 5],
    [16, 4, 10],
    [16, 5, 6],
    [11, 3, 4],
    [6, 1, 2],
    [4, 1, 1],
  ],
  [
    [17, 7, 6],
    [15, 6, 9],
    [15, 7, 5],
    [10, 5, 3],
    [5, 2, 2],
    [3, 2, 1],
  ],
  [
    [19, 6, 5],
    [17, 5, 8],
    [16, 6, 5],
    [12, 3, 3],
    [6, 2, 1],
    [4, 1, 1],
  ],
  [
    [18, 7, 5],
    [18, 4, 8],
    [17, 5, 5],
    [12, 3, 3],
    [6, 2, 1],
    [4, 1, 1],
  ],
  [
    [20, 6, 4],
    [19, 4, 7],
    [18, 4, 5],
    [13, 2, 3],
    [7, 1, 1],
    [4, 1, 1],
  ],
  [
    [21, 5, 4],
    [21, 3, 6],
    [19, 4, 4],
    [14, 2, 2],
    [7, 1, 1],
    [5, 0, 1],
  ],
].map((attempt) =>
  attempt.map(([correct, wrong, blank]) => ({ correct, wrong, blank })),
);

const EXPECTED_TOTALS = [
  "55.50",
  "62.75",
  "68.25",
  "57.75",
  "68.25",
  "69.50",
  "76.50",
  "83.25",
];

function requiredEmail(): string {
  const value = process.argv
    .find((arg) => arg.startsWith("--email="))
    ?.slice("--email=".length)
    .trim();
  if (!value) {
    throw new Error("Missing --email. Example: --email=user@example.com");
  }
  return value;
}

const PUBLISHERS = [
  "Yargı Yayınları",
  "Pegem Akademi",
  "Benim Hocam",
  "İsem Yayıncılık",
  "Data Yayınları",
  "Yediiklim",
  "Lider Yayınları",
  "Hız ve Renk",
] as const;

const PHOTO_SIGNALS = [
  { subjectRef: "turkce", attemptIndex: 7 },
  { subjectRef: "turkce", attemptIndex: 6 },
  { subjectRef: "turkce", attemptIndex: 5 },
  { subjectRef: "matematik", attemptIndex: 7 },
  { subjectRef: "matematik", attemptIndex: 6 },
  { subjectRef: "tarih", attemptIndex: 4 },
] as const;
function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function takenAt(daysAgo: number): Date {
  const date = new Date();
  date.setUTCHours(10, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

async function main(): Promise<void> {
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "production") {
    throw new Error("Refusing to seed analysis demo data in production.");
  }
  const email = requiredEmail();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.role','SERVICE',true)");

    const userResult = await client.query<{
      id: string;
      exam_type: string | null;
    }>(
      `select id, exam_type
         from users
        where lower(email) = lower($1) and status = 'ACTIVE'
        limit 1`,
      [email],
    );
    const user = userResult.rows[0];
    if (!user) throw new Error("Active user not found.");
    if (!user.exam_type) throw new Error("User has no exam type.");

    const examResult = await client.query<{
      id: string;
      name: string;
      net_rule: NetRule;
    }>(
      `select id, name, net_rule
         from exams
        where family = $1 and is_current = true
        order by created_at desc
        limit 1`,
      [user.exam_type],
    );
    const exam = examResult.rows[0];
    if (!exam)
      throw new Error("Current exam not found for the user's exam type.");

    const taxonomy = await client.query<{
      slug: string;
      question_count: number | null;
    }>(
      `select s.slug, es.question_count
         from exam_subjects es
         join subjects s on s.id = es.subject_id
        where es.exam_id = $1
        order by es.sort_order`,
      [exam.id],
    );
    const actualSlugs = taxonomy.rows.map((row) => row.slug);
    if (
      actualSlugs.length !== SUBJECTS.length ||
      SUBJECTS.some((slug, index) => actualSlugs[index] !== slug)
    ) {
      throw new Error(
        "Analysis demo seed requires the seeded KPSS six-subject taxonomy.",
      );
    }

    const offsets = [49, 42, 35, 28, 21, 14, 7, 0];
    const examIds: string[] = [];

    for (let attemptIndex = 0; attemptIndex < ATTEMPTS.length; attemptIndex++) {
      const scores = ATTEMPTS[attemptIndex]!;
      for (let subjectIndex = 0; subjectIndex < scores.length; subjectIndex++) {
        const expected = taxonomy.rows[subjectIndex]!.question_count;
        const score = scores[subjectIndex]!;
        if (
          expected == null ||
          score.correct + score.wrong + score.blank !== expected
        ) {
          throw new Error(
            `Demo score count mismatch for ${SUBJECTS[subjectIndex]}`,
          );
        }
      }

      const subjectNets = scores.map((score) =>
        computeSubjectNet(score, exam.net_rule),
      );
      const totalNet = formatNet(computeTotalNet(subjectNets));
      if (totalNet !== EXPECTED_TOTALS[attemptIndex]) {
        throw new Error(`Unexpected total net at attempt ${attemptIndex + 1}`);
      }

      const mockExamId = stableUuid(
        `${user.id}:analysis-demo:exam:${attemptIndex + 1}`,
      );
      examIds.push(mockExamId);
      await client.query(
        `insert into mock_exams
           (id, user_id, exam_id, taken_at, total_net, publisher_name)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set
           exam_id = excluded.exam_id,
           taken_at = excluded.taken_at,
           total_net = excluded.total_net,
           publisher_name = excluded.publisher_name,
           updated_at = now()`,
        [
          mockExamId,
          user.id,
          exam.id,
          takenAt(offsets[attemptIndex]!),
          totalNet,
          PUBLISHERS[attemptIndex]!,
        ],
      );

      await client.query(
        "delete from mock_exam_subjects where mock_exam_id = $1",
        [mockExamId],
      );
      for (let subjectIndex = 0; subjectIndex < scores.length; subjectIndex++) {
        const score = scores[subjectIndex]!;
        await client.query(
          `insert into mock_exam_subjects
             (id, mock_exam_id, subject_ref, correct, wrong, blank, net)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            stableUuid(
              `${user.id}:analysis-demo:subject:${attemptIndex + 1}:${SUBJECTS[subjectIndex]}`,
            ),
            mockExamId,
            SUBJECTS[subjectIndex],
            score.correct,
            score.wrong,
            score.blank,
            formatNet(subjectNets[subjectIndex]!),
          ],
        );
      }
    }

    await client.query(
      "delete from mock_exam_photo_categorizations " +
        "where user_id = $1 and storage_key like 'analysis-demo/%'",
      [user.id],
    );
    for (let index = 0; index < PHOTO_SIGNALS.length; index++) {
      const signal = PHOTO_SIGNALS[index]!;
      const clientRequestId = stableUuid(
        user.id + ":analysis-demo:photo-request:" + (index + 1),
      );
      await client.query(
        "insert into mock_exam_photo_categorizations " +
          "(id, user_id, mock_exam_id, subject_ref, storage_key, client_request_id) " +
          "values ($1, $2, $3, $4, $5, $6) " +
          "on conflict (user_id, client_request_id, subject_ref) do update set " +
          "mock_exam_id = excluded.mock_exam_id, storage_key = excluded.storage_key",
        [
          stableUuid(user.id + ":analysis-demo:photo:" + (index + 1)),
          user.id,
          examIds[signal.attemptIndex],
          signal.subjectRef,
          "analysis-demo/" +
            user.id +
            "/" +
            signal.subjectRef +
            "-" +
            (index + 1) +
            ".jpg",
          clientRequestId,
        ],
      );
    }

    const counts = await verifySeed(client, user.id, examIds);
    await client.query("COMMIT");
    console.log(
      `Analysis demo seeded for ${exam.name}: ${counts.exams} exams, ${counts.photos} photo signals.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function verifySeed(
  client: PoolClient,
  userId: string,
  examIds: string[],
): Promise<{ exams: number; photos: number }> {
  const exams = await client.query<{ count: number }>(
    "select count(*)::int as count from mock_exams where user_id = $1 and id = any($2::uuid[])",
    [userId, examIds],
  );
  const photos = await client.query<{ count: number }>(
    `select count(*)::int as count
       from mock_exam_photo_categorizations
      where user_id = $1 and storage_key like 'analysis-demo/%'`,
    [userId],
  );
  const result = {
    exams: exams.rows[0]?.count ?? 0,
    photos: photos.rows[0]?.count ?? 0,
  };
  if (result.exams !== 8 || result.photos !== 6) {
    throw new Error(
      `Seed verification failed: ${result.exams} exams, ${result.photos} photos`,
    );
  }
  return result;
}

void main().catch((error: unknown) => {
  console.error(
    "Analysis demo seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
