/**
 * Dev-only seed for manually testing the human-coach follow-up cycle.
 *
 * Run:
 * pnpm --filter @mentor/api seed:mentorship-followups -- --coach-email=coach@example.com
 * Optionally add --student-email=student@example.com to target one active link.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";

type FollowupSeed = {
  key: string;
  title: string;
  privateNote: string | null;
  sharedDecision: string | null;
  response: "PENDING" | "ACCEPTED" | "CHANGE_REQUESTED";
  followUpDate: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  version: number;
  respondedAt: Date | null;
  closedAt: Date | null;
  replacesKey?: string;
  createdDaysAgo: number;
};

function argument(name: string, required = false): string | undefined {
  const value = process.argv
    .find((item) => item.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
    .trim();
  if (required && !value) {
    throw new Error(`Missing --${name}.`);
  }
  return value || undefined;
}

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

function istanbulDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function scenarios(now: Date): FollowupSeed[] {
  return [
    {
      key: "due-pending",
      title: "Bugünkü kontrol: çalışma ritmi",
      privateNote: "Görüşmede son üç günün sürdürülebilirliğini sor.",
      sharedDecision: "Bugün çalışma ritmimizi birlikte kontrol edeceğiz.",
      response: "PENDING",
      followUpDate: istanbulDate(0),
      status: "OPEN",
      version: 1,
      respondedAt: null,
      closedAt: null,
      createdDaysAgo: 2,
    },
    {
      key: "overdue-change",
      title: "Matematik programını sadeleştir",
      privateNote: "Öğrenci yoğunluğu yüksek buldu; iki güne bölmeyi konuş.",
      sharedDecision: "Bu hafta matematik için üç uzun oturum planlayalım.",
      response: "CHANGE_REQUESTED",
      followUpDate: istanbulDate(-2),
      status: "OPEN",
      version: 2,
      respondedAt: new Date(now.getTime() - 86_400_000),
      closedAt: null,
      createdDaysAgo: 5,
    },
    {
      key: "future-accepted",
      title: "Deneme sonrası değerlendirme",
      privateNote: "Netten önce zorlandığı konu başlıklarını dinle.",
      sharedDecision:
        "Pazar günkü denemeden sonra sonuçları birlikte değerlendireceğiz.",
      response: "ACCEPTED",
      followUpDate: istanbulDate(4),
      status: "OPEN",
      version: 2,
      respondedAt: new Date(now.getTime() - 2 * 86_400_000),
      closedAt: null,
      createdDaysAgo: 4,
    },
    {
      key: "private-only",
      title: "Motivasyon kontrolü",
      privateNote: "Bir sonraki görüşmede enerji düzeyini nazikçe sor.",
      sharedDecision: null,
      response: "PENDING",
      followUpDate: null,
      status: "OPEN",
      version: 1,
      respondedAt: null,
      closedAt: null,
      createdDaysAgo: 1,
    },
    {
      key: "completed-original",
      title: "İlk haftanın hedefi",
      privateNote: "İlk öneri kapatıldı; yeni kayıt üzerinden devam edildi.",
      sharedDecision: "Her gün iki saat kesintisiz çalışacağız.",
      response: "CHANGE_REQUESTED",
      followUpDate: istanbulDate(-6),
      status: "COMPLETED",
      version: 3,
      respondedAt: new Date(now.getTime() - 7 * 86_400_000),
      closedAt: new Date(now.getTime() - 6 * 86_400_000),
      createdDaysAgo: 9,
    },
    {
      key: "replacement",
      title: "İlk haftanın güncellenen hedefi",
      privateNote: "Daha küçük hedef üzerinde uzlaşıldı.",
      sharedDecision: "Her gün iki kısa odak oturumu deneyeceğiz.",
      response: "ACCEPTED",
      followUpDate: istanbulDate(2),
      status: "OPEN",
      version: 2,
      respondedAt: new Date(now.getTime() - 5 * 86_400_000),
      closedAt: null,
      replacesKey: "completed-original",
      createdDaysAgo: 6,
    },
  ];
}

async function seedLink(
  client: PoolClient,
  link: { id: string; periodId: string; studentEmail: string },
): Promise<void> {
  const now = new Date();
  const rows = scenarios(now);
  const ids = new Map(
    rows.map((row) => [
      row.key,
      stableUuid(`${link.id}:${link.periodId}:followup:${row.key}`),
    ]),
  );
  for (const row of rows) {
    const id = ids.get(row.key)!;
    const operationId = stableUuid(
      `${link.id}:${link.periodId}:operation:${row.key}`,
    );
    const requestHash = createHash("sha256")
      .update(`${link.id}:${link.periodId}:${row.key}`)
      .digest("hex");
    const createdAt = new Date(now.getTime() - row.createdDaysAgo * 86_400_000);
    await client.query(
      `insert into mentorship_followups
         (id, link_id, period_id, operation_id, request_hash, response_version,
          title, private_note, shared_decision, response, follow_up_date, status,
          version, replaces_id, created_at, updated_at, responded_at, closed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $15, $16, $17)
       on conflict (id) do update set
         request_hash = excluded.request_hash,
         response_version = excluded.response_version,
         title = excluded.title,
         private_note = excluded.private_note,
         shared_decision = excluded.shared_decision,
         response = excluded.response,
         follow_up_date = excluded.follow_up_date,
         status = excluded.status,
         version = excluded.version,
         replaces_id = excluded.replaces_id,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         responded_at = excluded.responded_at,
         closed_at = excluded.closed_at`,
      [
        id,
        link.id,
        link.periodId,
        operationId,
        requestHash,
        row.response === "PENDING" ? null : row.version,
        row.title,
        row.privateNote,
        row.sharedDecision,
        row.response,
        row.followUpDate,
        row.status,
        row.version,
        row.replacesKey ? ids.get(row.replacesKey) : null,
        createdAt,
        row.respondedAt,
        row.closedAt,
      ],
    );
  }
  const result = await client.query<{ count: number }>(
    `select count(*)::int as count from mentorship_followups
      where link_id = $1 and period_id = $2 and id = any($3::uuid[])`,
    [link.id, link.periodId, [...ids.values()]],
  );
  if (result.rows[0]?.count !== rows.length) {
    throw new Error(`Seed verification failed for ${link.studentEmail}.`);
  }
}

async function main(): Promise<void> {
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "production") {
    throw new Error("Refusing to seed mentorship follow-ups in production.");
  }
  const coachEmail = argument("coach-email", true)!;
  const studentEmail = argument("student-email");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.role','SERVICE',true)");
    const result = await client.query<{
      id: string;
      periodId: string;
      studentEmail: string;
    }>(
      `select cs.id, cs.period_id as "periodId", student.email as "studentEmail"
         from coach_students cs
         join users coach on coach.id = cs.coach_id
         join users student on student.id = cs.student_id
        where cs.status = 'ACTIVE'
          and coach.status = 'ACTIVE'
          and student.status = 'ACTIVE'
          and 'COACH' = any(coach.roles)
          and lower(coach.email) = lower($1)
          and ($2::text is null or lower(student.email) = lower($2))
        order by lower(student.email)`,
      [coachEmail, studentEmail ?? null],
    );
    if (result.rows.length === 0) {
      throw new Error(
        "No active coach-student link matched the supplied email(s).",
      );
    }
    for (const link of result.rows) await seedLink(client, link);
    await client.query("COMMIT");
    console.log(
      `Mentorship follow-up demo seeded: ${result.rows.length} student(s), ` +
        `${result.rows.length * 6} records.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(
    "Mentorship follow-up seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
