/**
 * Dev-only seed for the completed-week coach report flow.
 *
 * Run:
 * pnpm --filter @mentor/api seed:mentorship-weekly-report -- --coach-email=coach@example.com
 * Optionally add --student-email=student@example.com to target one active link.
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
import { buildMentorshipWeeklyReportDemoSchedule } from "./mentorship-weekly-report-demo.schedule";

interface ActiveLink {
  id: string;
  periodId: string;
  studentId: string;
  studentEmail: string;
  examType: string;
}

interface ExamSubject {
  slug: string;
  name: string;
  questionCount: number;
}

function argument(name: string, required = false): string | undefined {
  const value = process.argv
    .find((item) => item.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
    .trim();
  if (required && !value) throw new Error(`Missing --${name}.`);
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

async function seedLink(client: PoolClient, link: ActiveLink): Promise<void> {
  const schedule = buildMentorshipWeeklyReportDemoSchedule();
  const examResult = await client.query<{
    id: string;
    name: string;
    netRule: NetRule;
  }>(
    `select id, name, net_rule as "netRule"
       from exams
      where family = $1 and is_current = true
      order by created_at desc
      limit 1`,
    [link.examType],
  );
  const exam = examResult.rows[0];
  if (!exam) throw new Error(`Current exam not found for ${link.studentEmail}.`);

  const subjectResult = await client.query<ExamSubject>(
    `select s.slug, s.name, es.question_count as "questionCount"
       from exam_subjects es
       join subjects s on s.id = es.subject_id
      where es.exam_id = $1 and es.question_count > 0
      order by es.sort_order`,
    [exam.id],
  );
  const subjects = subjectResult.rows;
  if (subjects.length < 3) {
    throw new Error(`At least three exam subjects are required for ${exam.name}.`);
  }

  const scope = `${link.id}:${link.periodId}:weekly-report-demo`;
  const sessionIds: string[] = [];
  for (const row of schedule.sessions) {
    const id = stableUuid(`${scope}:session:${row.key}`);
    sessionIds.push(id);
    await client.query(
      `insert into study_sessions
         (id, user_id, started_at, ended_at, preset, planned_focus_minutes,
          actual_focus_seconds, subject, status)
       values ($1, $2, $3, $4, 'custom', $5, $6, $7, 'COMPLETED')
       on conflict (id) do update set
         started_at = excluded.started_at,
         ended_at = excluded.ended_at,
         planned_focus_minutes = excluded.planned_focus_minutes,
         actual_focus_seconds = excluded.actual_focus_seconds,
         subject = excluded.subject,
         status = excluded.status,
         updated_at = now()`,
      [
        id,
        link.studentId,
        row.startedAt,
        row.endedAt,
        row.focusMinutes,
        row.focusMinutes * 60,
        row.subjectIndex === null ? null : subjects[row.subjectIndex]!.name,
      ],
    );
  }

  const taskIds: string[] = [];
  for (const row of schedule.tasks) {
    const id = stableUuid(`${scope}:task:${row.key}`);
    const subject = subjects[row.subjectIndex]!;
    taskIds.push(id);
    await client.query(
      `insert into plan_tasks
         (id, user_id, task_date, title, subject, status, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update set
         task_date = excluded.task_date,
         title = excluded.title,
         subject = excluded.subject,
         status = excluded.status,
         sort_order = excluded.sort_order,
         updated_at = now()`,
      [
        id,
        link.studentId,
        row.taskDate,
        `${subject.name} çalışmasını tamamla`,
        subject.name,
        row.status,
        row.sortOrder,
      ],
    );
  }

  const mockIds: string[] = [];
  for (const row of schedule.attempts) {
    const id = stableUuid(`${scope}:mock:${row.key}`);
    const scores = subjects.map((subject) =>
      buildScore(subject.questionCount, row.scoreRatio),
    );
    const nets = scores.map((score) => computeSubjectNet(score, exam.netRule));
    mockIds.push(id);
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
        id,
        link.studentId,
        exam.id,
        row.takenAt,
        formatNet(computeTotalNet(nets)),
        row.publisher,
      ],
    );
    await client.query("delete from mock_exam_subjects where mock_exam_id = $1", [id]);
    for (let index = 0; index < subjects.length; index++) {
      const subject = subjects[index]!;
      const score = scores[index]!;
      await client.query(
        `insert into mock_exam_subjects
           (id, mock_exam_id, subject_ref, correct, wrong, blank, net)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stableUuid(`${scope}:mock-subject:${row.key}:${subject.slug}`),
          id,
          subject.slug,
          score.correct,
          score.wrong,
          score.blank,
          formatNet(nets[index]!),
        ],
      );
    }
  }

  await verifySeed(client, link, sessionIds, taskIds, mockIds, subjects.length);
  console.log(
    `Weekly report demo seeded for ${link.studentEmail}: ` +
      `${schedule.previousStartDate} and ${schedule.currentStartDate}.`,
  );
}

function buildScore(questionCount: number, ratio: number): SubjectScoreInput {
  const correct = Math.floor(questionCount * ratio);
  const remaining = questionCount - correct;
  const wrong = Math.floor(remaining / 2);
  return { correct, wrong, blank: questionCount - correct - wrong };
}

async function verifySeed(
  client: PoolClient,
  link: ActiveLink,
  sessionIds: string[],
  taskIds: string[],
  mockIds: string[],
  subjectCount: number,
): Promise<void> {
  const result = await client.query<{
    sessions: number;
    tasks: number;
    mocks: number;
    mockSubjects: number;
  }>(
    `select
       (select count(*)::int from study_sessions where user_id = $1 and id = any($2::uuid[])) as sessions,
       (select count(*)::int from plan_tasks where user_id = $1 and id = any($3::uuid[])) as tasks,
       (select count(*)::int from mock_exams where user_id = $1 and id = any($4::uuid[])) as mocks,
       (select count(*)::int from mock_exam_subjects where mock_exam_id = any($4::uuid[])) as "mockSubjects"`,
    [link.studentId, sessionIds, taskIds, mockIds],
  );
  const counts = result.rows[0];
  if (
    !counts ||
    counts.sessions !== 9 ||
    counts.tasks !== 11 ||
    counts.mocks !== 2 ||
    counts.mockSubjects !== subjectCount * 2
  ) {
    throw new Error(`Seed verification failed for ${link.studentEmail}.`);
  }
}

async function main(): Promise<void> {
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "production") {
    throw new Error("Refusing to seed mentorship weekly reports in production.");
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
    const links = await client.query<ActiveLink>(
      `select cs.id, cs.period_id as "periodId", student.id as "studentId",
              student.email as "studentEmail", student.exam_type as "examType"
         from coach_students cs
         join users coach on coach.id = cs.coach_id
         join users student on student.id = cs.student_id
        where cs.status = 'ACTIVE'
          and cs.period_id is not null
          and coach.status = 'ACTIVE'
          and student.status = 'ACTIVE'
          and student.exam_type is not null
          and 'COACH' = any(coach.roles)
          and lower(coach.email) = lower($1)
          and ($2::text is null or lower(student.email) = lower($2))
        order by lower(student.email)`,
      [coachEmail, studentEmail ?? null],
    );
    if (links.rows.length === 0) {
      throw new Error("No active coach-student link matched the supplied email(s).");
    }
    for (const link of links.rows) await seedLink(client, link);
    await client.query("COMMIT");
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
    "Mentorship weekly report seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
