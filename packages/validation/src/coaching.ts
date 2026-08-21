/**
 * Coaching schemas (W2 daily loop + mood) — shared FE+BE (§8 single validation source).
 * Field copy is NOT here: user-facing messages are localized by the backend.
 */
import { z } from "zod";
import {
  CAREER_GROUPS,
  NOTEBOOK_ERROR_TYPES,
  NOTEBOOK_INK_TOOLS,
  NOTEBOOK_PAPERS,
  NOTEBOOK_SOURCES,
  VISION_BOARD_FRAMES,
  VISION_BOARD_TEXTURES,
  VISION_IMAGE_FRAMES,
  VISION_STICKERS,
  VISION_TEXT_ALIGNS,
  VISION_TEXT_FONTS,
  YKS_SCORE_TYPES,
} from "@mentor/types";
// NOTE: import from the leaf module, NOT "./index.js" — a barrel import here creates an
// index↔coaching cycle that crashes sync ESM-from-CJS loading (ts-node / node dist).
import { paginationQuerySchema } from "./pagination.js";

/** ISO calendar date (yyyy-mm-dd) that is also a real day. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) &&
      s === new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10),
    { message: "invalid_date" },
  );

export const PLAN_TASK_STATUSES = ["PENDING", "DONE"] as const;
export const SESSION_PRESETS = ["25_5", "50_10", "custom"] as const;
export const STUDY_SESSION_STATUSES = ["IN_PROGRESS", "COMPLETED", "ABANDONED"] as const;
/** Status values allowed when finalizing a session (complete / abandon). */
export const FINAL_STUDY_SESSION_STATUSES = ["COMPLETED", "ABANDONED"] as const;

/* --------------------------------- plan tasks --------------------------------- */

/** Wall-clock time of day, "HH:MM" (24h). */
export const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Max description length — a calendar note, not an essay. */
export const PLAN_TASK_DESCRIPTION_MAX = 2000;

/**
 * `startTime` null/absent = all-day item. `endTime` requires a `startTime` and must be later —
 * mirrors the `plan_tasks_time_range_chk` DB constraint (both sides, never one).
 */
function refinePlanTaskTimes(
  value: { startTime?: string | null; endTime?: string | null },
  ctx: z.RefinementCtx,
): void {
  const { startTime, endTime } = value;
  if (endTime === undefined || endTime === null) return;
  if (startTime === undefined || startTime === null) {
    ctx.addIssue({ code: "custom", message: "end_without_start", path: ["endTime"] });
    return;
  }
  if (endTime <= startTime) {
    ctx.addIssue({ code: "custom", message: "end_before_start", path: ["endTime"] });
  }
}

export const createPlanTaskSchema = z
  .object({
    /** Defaults to the server's "today" when omitted. */
    taskDate: isoDateSchema.optional(),
    title: z.string().trim().min(1).max(200),
    subject: z.string().trim().min(1).max(80).nullish(),
    /** Null/absent = all-day. */
    startTime: hhmmSchema.nullish(),
    endTime: hhmmSchema.nullish(),
    description: z.string().trim().max(PLAN_TASK_DESCRIPTION_MAX).nullish(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .superRefine(refinePlanTaskTimes);
export type CreatePlanTaskInput = z.infer<typeof createPlanTaskSchema>;

/** POST /v1/plan-tasks/bulk — user-confirmed batch add (e.g. accepted coach draft). */
export const bulkCreatePlanTasksSchema = z.object({
  tasks: createPlanTaskSchema.array().min(1).max(21),
});
export type BulkCreatePlanTasksInput = z.infer<typeof bulkCreatePlanTasksSchema>;

const planAdaptationMoveSchema = z.object({
  kind: z.literal("MOVE"),
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(80).nullable(),
  fromDate: isoDateSchema,
  toDate: isoDateSchema,
});

const planAdaptationAddSchema = z.object({
  kind: z.literal("ADD"),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(80).nullable(),
  taskDate: isoDateSchema,
});

export const planAdaptationChangeSchema = z.discriminatedUnion("kind", [
  planAdaptationMoveSchema,
  planAdaptationAddSchema,
]);

export const applyPlanAdaptationSchema = z.object({
  planRevision: z.string().regex(/^[a-f0-9]{64}$/),
  changes: planAdaptationChangeSchema.array().min(1).max(5),
});
export type ApplyPlanAdaptationInput = z.infer<typeof applyPlanAdaptationSchema>;

/**
 * Times are patched as a PAIR: sending `endTime` without `startTime` in the same payload is
 * rejected (clearing = send both as null). Keeps the check payload-local instead of needing a
 * read-modify-validate round-trip against the stored row.
 */
export const updatePlanTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    subject: z.string().trim().min(1).max(80).nullish(),
    status: z.enum(PLAN_TASK_STATUSES).optional(),
    startTime: hhmmSchema.nullish(),
    endTime: hhmmSchema.nullish(),
    description: z.string().trim().max(PLAN_TASK_DESCRIPTION_MAX).nullish(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .superRefine(refinePlanTaskTimes)
  .refine((v) => Object.keys(v).length > 0, { message: "empty" });
export type UpdatePlanTaskInput = z.infer<typeof updatePlanTaskSchema>;

export const listPlanTasksQuerySchema = paginationQuerySchema
  .extend({
    /** Single-day filter — mutually exclusive with `from`/`to`. */
    date: isoDateSchema.optional(),
    /** Inclusive range start — requires `to`. */
    from: isoDateSchema.optional(),
    /** Inclusive range end — requires `from`. Max 62 days. */
    to: isoDateSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasDate = data.date !== undefined;
    const hasFrom = data.from !== undefined;
    const hasTo = data.to !== undefined;

    if (hasDate && (hasFrom || hasTo)) {
      ctx.addIssue({ code: "custom", message: "date_or_range", path: ["date"] });
      return;
    }

    if (hasFrom !== hasTo) {
      ctx.addIssue({
        code: "custom",
        message: "from_to_pair",
        path: hasFrom ? ["to"] : ["from"],
      });
      return;
    }

    if (hasFrom && hasTo) {
      if (data.from! > data.to!) {
        ctx.addIssue({ code: "custom", message: "invalid_range", path: ["to"] });
        return;
      }
      const fromMs = new Date(`${data.from}T12:00:00`).getTime();
      const toMs = new Date(`${data.to}T12:00:00`).getTime();
      const dayCount = Math.floor((toMs - fromMs) / 86_400_000) + 1;
      if (dayCount > 62) {
        ctx.addIssue({ code: "custom", message: "range_too_large", path: ["to"] });
      }
    }
  });
export type ListPlanTasksQuery = z.infer<typeof listPlanTasksQuerySchema>;

/** Calendar dot map — distinct task dates in an inclusive range (max 62 days). */
export const planTaskCalendarQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .superRefine((data, ctx) => {
    if (data.from > data.to) {
      ctx.addIssue({ code: "custom", message: "invalid_range", path: ["to"] });
      return;
    }
    const fromMs = new Date(`${data.from}T12:00:00`).getTime();
    const toMs = new Date(`${data.to}T12:00:00`).getTime();
    const dayCount = Math.floor((toMs - fromMs) / 86_400_000) + 1;
    if (dayCount > 62) {
      ctx.addIssue({ code: "custom", message: "range_too_large", path: ["to"] });
    }
  });
export type PlanTaskCalendarQuery = z.infer<typeof planTaskCalendarQuerySchema>;

/* ------------------------------- study sessions ------------------------------- */

export const startStudySessionSchema = z
  .object({
    preset: z.enum(SESSION_PRESETS),
    /** Required when preset is `custom`; 5-minute steps from 5 to 120. */
    focusMinutes: z.coerce
      .number()
      .int()
      .min(5)
      .max(120)
      .refine((v) => v % 5 === 0, { message: "invalid_focus_minutes_step" })
      .optional(),
    subject: z.string().trim().min(1).max(80).nullish(),
    /** When starting from a plan task deep-link; must belong to the current user. */
    planTaskId: z.string().uuid().optional(),
    /** ISO datetime; defaults to server "now" when omitted. */
    startedAt: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.preset === "custom" && data.focusMinutes == null) {
      ctx.addIssue({
        code: "custom",
        message: "focus_minutes_required",
        path: ["focusMinutes"],
      });
    }
  });
export type StartStudySessionInput = z.infer<typeof startStudySessionSchema>;

export const updateStudySessionSchema = z.object({
  status: z.enum(FINAL_STUDY_SESSION_STATUSES),
  actualFocusSeconds: z.coerce.number().int().min(0).max(86_400),
});
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;

/**
 * Post-session micro check-in (roadmap §258): a subjective effort/mood signal (1-3, 😩😐🙂)
 * with an optional "what challenged you" note. Attached to an already-finalized session so the
 * finalize path stays untouched; idempotent (re-submit overwrites).
 */
export const sessionFeedbackSchema = z.object({
  mood: z.coerce.number().int().min(1).max(3),
  struggleNote: z.string().trim().max(280).optional(),
});
export type SessionFeedbackInput = z.infer<typeof sessionFeedbackSchema>;

/** Paginated study-session history (most recent finalized first). */
export const listStudySessionsQuerySchema = paginationQuerySchema
  .extend({
    subject: z.string().trim().min(1).max(100).optional(),
    /** Inclusive UTC start day (yyyy-mm-dd) for `started_at` filter. */
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    /** Inclusive UTC end day (yyyy-mm-dd) for `started_at` filter. */
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "invalid_date_range",
    path: ["from"],
  });
export type ListStudySessionsQuery = z.infer<typeof listStudySessionsQuerySchema>;

/* ---------------------------------- mood -------------------------------------- */

export const createMoodCheckinSchema = z.object({
  /** 1 (very low) .. 5 (great). */
  mood: z.coerce.number().int().min(1).max(5),
  /** Optional subjective signal ("bugün seni en çok zorlayan konu"); blank → omitted. */
  struggleNote: z.string().trim().max(280).optional(),
});
export type CreateMoodCheckinInput = z.infer<typeof createMoodCheckinSchema>;

export const listMoodCheckinsQuerySchema = paginationQuerySchema;
export type ListMoodCheckinsQuery = z.infer<typeof listMoodCheckinsQuerySchema>;

/* -------------------------------- vision board -------------------------------- */

/** One text-based goal anchor per user ("hayal/hedef panosu"); upsert (idempotent per user). */
/**
 * Province plate code, zero-padded: 01–81. Rejects "00" and anything above 81, so a malformed
 * client value fails here instead of becoming a dangling FK at insert time.
 */
export const cityCodeSchema = z.string().regex(/^(0[1-9]|[1-7]\d|8[01])$/);

/**
 * `targetCityCode` is the normalized map selection; `targetCity` stays as the free-text fallback
 * for goals the province list can't express. A university is only meaningful alongside its city,
 * so the pair is enforced here — and the service additionally verifies the university really
 * belongs to that city (this schema can't know, and the client is not trusted).
 */
export const upsertVisionSchema = z
  .object({
    goalTitle: z.string().trim().min(1).max(120),
    targetCityCode: cityCodeSchema.nullish(),
    targetCity: z.string().trim().min(1).max(80).nullish(),
    targetUniversityId: z.string().uuid().nullish(),
    targetTitleId: z.string().uuid().nullish(),
    targetInstitutionId: z.string().uuid().nullish(),
    careerGroup: z.enum(CAREER_GROUPS).nullish(),
    motivation: z.string().trim().min(1).max(500).nullish(),
  })
  .refine((v) => !v.targetUniversityId || Boolean(v.targetCityCode), {
    message: "university_requires_city",
    path: ["targetCityCode"],
  });
export type UpsertVisionInput = z.infer<typeof upsertVisionSchema>;

/* ----------------------------- vision board collage ----------------------------- */

/**
 * Caps. They exist for two reasons that have nothing to do with taste: the document is stored as
 * one jsonb value and re-sent on every `/coaching/vision` read, and the panel card renders every
 * image at once. Twenty photos is already a busy collage.
 */
export const VISION_BOARD_MAX_ITEMS = 60;
export const VISION_BOARD_MAX_IMAGES = 20;
export const VISION_BOARD_MAX_TEXTS = 30;

/** Board photos live at `vision-board/{userId}/{uuid}.{ext}`. The owner check is the service's job. */
export const visionBoardStorageKeySchema = z
  .string()
  .regex(
    /^vision-board\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i,
    "invalid_storage_key",
  );

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "invalid_color");

/**
 * Coordinates are absolute px in the 1620×1080 design space, deliberately allowed well outside it:
 * letting a photo bleed past the edge is normal collage composition and the stage clips it. The
 * bounds only exist to keep a crafted document from carrying Infinity into a canvas draw call.
 */
const coordSchema = z.coerce.number().finite().min(-5_000).max(5_000);
const sizeSchema = z.coerce.number().finite().min(8).max(5_000);

/** Exported: the mistake notebook composes the same geometry into its own document. */
export const boardItemBaseShape = {
  id: z.string().uuid(),
  x: coordSchema,
  y: coordSchema,
  width: sizeSchema,
  height: sizeSchema,
  rotation: z.coerce.number().finite().min(-180).max(180),
  opacity: z.coerce.number().finite().min(0).max(1),
  z: z.coerce.number().int().min(0).max(999),
};

const boardImageItemSchema = z.object({
  ...boardItemBaseShape,
  kind: z.literal("image"),
  storageKey: visionBoardStorageKeySchema,
  frame: z.enum(VISION_IMAGE_FRAMES),
});

export const boardTextItemSchema = z.object({
  ...boardItemBaseShape,
  kind: z.literal("text"),
  text: z.string().trim().min(1).max(280),
  font: z.enum(VISION_TEXT_FONTS),
  size: z.coerce.number().finite().min(12).max(160),
  color: hexColorSchema,
  bold: z.boolean(),
  italic: z.boolean(),
  align: z.enum(VISION_TEXT_ALIGNS),
  lineHeight: z.coerce.number().finite().min(0.8).max(3),
  letterSpacing: z.coerce.number().finite().min(-10).max(40),
  background: z
    .object({
      color: hexColorSchema,
      opacity: z.coerce.number().finite().min(0).max(1),
      padding: z.coerce.number().finite().min(0).max(80),
      radius: z.coerce.number().finite().min(0).max(80),
    })
    .nullable(),
  source: z.literal("goal").optional(),
});

export const boardStickerItemSchema = z.object({
  ...boardItemBaseShape,
  kind: z.literal("sticker"),
  asset: z.enum(VISION_STICKERS),
});

const boardItemSchema = z.discriminatedUnion("kind", [
  boardImageItemSchema,
  boardTextItemSchema,
  boardStickerItemSchema,
]);

/**
 * The full collage. Written by `PUT /coaching/vision/board` only — never by the goal upsert, whose
 * AI-note invalidation must not fire because somebody nudged a sticker.
 */
export const visionBoardDocSchema = z
  .object({
    version: z.literal(1),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    frame: z.enum(VISION_BOARD_FRAMES),
    background: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("color"), value: hexColorSchema }),
      z.object({ kind: z.literal("texture"), value: z.enum(VISION_BOARD_TEXTURES) }),
    ]),
    items: z.array(boardItemSchema).max(VISION_BOARD_MAX_ITEMS),
  })
  .superRefine((doc, ctx) => {
    const images = doc.items.filter((i) => i.kind === "image").length;
    if (images > VISION_BOARD_MAX_IMAGES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "too_many_images",
        path: ["items"],
      });
    }
    const texts = doc.items.filter((i) => i.kind === "text").length;
    if (texts > VISION_BOARD_MAX_TEXTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "too_many_texts",
        path: ["items"],
      });
    }
    // Duplicate ids would make selection and undo target the wrong element.
    if (new Set(doc.items.map((i) => i.id)).size !== doc.items.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate_item_id",
        path: ["items"],
      });
    }
  });
export type VisionBoardDocInput = z.infer<typeof visionBoardDocSchema>;

export const putVisionBoardSchema = z.object({ board: visionBoardDocSchema });
export type PutVisionBoardInput = z.infer<typeof putVisionBoardSchema>;

/** Board photo upload. Same allowlist as forum images — webp included, no HEIC/SVG. */
export const VISION_BOARD_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const VISION_BOARD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const visionBoardImageUploadUrlSchema = z.object({
  contentType: z.enum(VISION_BOARD_IMAGE_MIMES),
});
export type VisionBoardImageUploadUrlInput = z.infer<
  typeof visionBoardImageUploadUrlSchema
>;

/* --------------------------- preference simulation --------------------------- */

const yksRankSchema = z.coerce.number().int().min(1).max(9_999_999).nullish();

export const preferenceRanksSchema = z.object(
  Object.fromEntries(YKS_SCORE_TYPES.map((type) => [type, yksRankSchema])) as {
    [K in (typeof YKS_SCORE_TYPES)[number]]: typeof yksRankSchema;
  },
);

const programCodeSchema = z.string().regex(/^\d{9}$/);

export const putPreferenceSimulationSchema = z
  .object({
    datasetVersion: z.string().trim().min(1).max(80),
    expectedRevision: z.coerce.number().int().min(0),
    ranks: preferenceRanksSchema,
    programCodes: programCodeSchema.array().max(100),
  })
  .refine(
    (value) => new Set(value.programCodes).size === value.programCodes.length,
    { message: "duplicate_program_code", path: ["programCodes"] },
  );
export type PutPreferenceSimulationInput = z.infer<
  typeof putPreferenceSimulationSchema
>;

export const refreshPreferenceSimulationSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
});
export type RefreshPreferenceSimulationInput = z.infer<
  typeof refreshPreferenceSimulationSchema
>;

/* -------------------------------- mock exams -------------------------------- */

export const mockExamSubjectInputSchema = z.object({
  subjectRef: z.string().trim().min(1).max(80),
  correct: z.coerce.number().int().min(0).max(500),
  wrong: z.coerce.number().int().min(0).max(500),
  blank: z.coerce.number().int().min(0).max(500),
});

export const createMockExamSchema = z
  .object({
    examId: z.string().uuid(),
    takenAt: z.string().datetime({ offset: true }).optional(),
    publisherName: z.string().trim().min(1).max(120).optional(),
    subjects: z.array(mockExamSubjectInputSchema).min(1).max(20),
  })
  .refine(
    (data) => new Set(data.subjects.map((s) => s.subjectRef)).size === data.subjects.length,
    { message: "duplicate_subject_ref" },
  );
export type CreateMockExamInput = z.infer<typeof createMockExamSchema>;

export const updateMockExamSchema = z
  .object({
    takenAt: z.string().datetime({ offset: true }),
    publisherName: z.string().trim().min(1).max(120).nullable(),
    subjects: z.array(mockExamSubjectInputSchema).min(1).max(20),
  })
  .refine(
    (data) => new Set(data.subjects.map((subject) => subject.subjectRef)).size === data.subjects.length,
    { message: "duplicate_subject_ref" },
  );
export type UpdateMockExamInput = z.infer<typeof updateMockExamSchema>;

export const analysisQuerySchema = z.object({
  examId: z.string().uuid().optional(),
});
export type AnalysisQuery = z.infer<typeof analysisQuerySchema>;

export const listMockExamsQuerySchema = paginationQuerySchema.extend({
  examId: z.string().uuid().optional(),
});
export type ListMockExamsQuery = z.infer<typeof listMockExamsQuerySchema>;


/** Active-exam scope for the completed weekly review. */
export const weeklyReviewQuerySchema = z.object({
  examId: z.string().uuid(),
});
export type WeeklyReviewQuery = z.infer<typeof weeklyReviewQuerySchema>;

export const completeWeeklyReviewSchema = z.object({
  examId: z.string().uuid(),
  weekStart: z.string().date(),
});
export type CompleteWeeklyReviewInput = z.infer<typeof completeWeeklyReviewSchema>;

/* ------------------------------- mistake notebook ------------------------------- */

/**
 * Per-page caps. Lower than the board's on purpose: a page is read and written as one jsonb value
 * and a page crowded past this stops reading as a page. Running out is the prompt to turn to a new
 * one, which is exactly the interaction we want.
 */
export const NOTEBOOK_PAGE_MAX_ITEMS = 40;
export const NOTEBOOK_PAGE_MAX_ENTRIES = 12;
export const NOTEBOOK_MAX_PAGES = 200;

/** Notebook photos live at `notebook/{userId}/{uuid}.{ext}`. The owner check is the service's job. */
export const notebookStorageKeySchema = z
  .string()
  .regex(
    /^notebook\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i,
    "invalid_storage_key",
  );

/** Same allowlist as the board and forum uploaders — webp in, no HEIC/SVG. */
export const NOTEBOOK_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const NOTEBOOK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Cap on the student's own note about a mistake. Exported because the note is now editable from the
 * review card too, and a `maxLength` on that textarea that disagrees with the schema is a form that
 * lets you type text the server will refuse.
 */
export const NOTEBOOK_NOTE_MAX_LENGTH = 500;

export const notebookImageUploadUrlSchema = z.object({
  contentType: z.enum(NOTEBOOK_IMAGE_MIMES),
});
export type NotebookImageUploadUrlInput = z.infer<
  typeof notebookImageUploadUrlSchema
>;

const notebookEntryItemSchema = z.object({
  ...boardItemBaseShape,
  kind: z.literal("entry"),
  entryId: z.string().uuid(),
});

const notebookPageItemSchema = z.discriminatedUnion("kind", [
  notebookEntryItemSchema,
  boardTextItemSchema,
  boardStickerItemSchema,
]);

/**
 * Ink budget. Three caps rather than one because they fail differently: the stroke cap keeps the
 * SVG layer's path count in a range browsers render smoothly, the per-stroke cap stops one endless
 * scribble from being the whole page, and the total-point cap is the only one that actually bounds
 * the jsonb — 12k samples is roughly 200 KB of document, which still autosaves inside the 900 ms
 * debounce.
 *
 * The client simplifies each stroke (RDP) before storing it, so a normal drawing lands far under
 * these; hitting them means something is wrong, not that somebody drew a lot.
 */
export const NOTEBOOK_PAGE_MAX_STROKES = 200;
export const NOTEBOOK_INK_MAX_POINTS = 400;
export const NOTEBOOK_INK_MAX_TOTAL_POINTS = 12_000;

/** `[x, y, pressure]` per sample — see `NotebookInkStroke` for why the array is flat. */
const NOTEBOOK_INK_POINT_STRIDE = 3;

const notebookInkStrokeSchema = z.object({
  id: z.string().uuid(),
  tool: z.enum(NOTEBOOK_INK_TOOLS),
  color: hexColorSchema,
  size: z.coerce.number().finite().min(1).max(120),
  opacity: z.coerce.number().finite().min(0).max(1),
  points: z
    .array(coordSchema)
    // Two samples minimum: one point is a tap, and the outline algorithm has nothing to widen.
    .min(NOTEBOOK_INK_POINT_STRIDE * 2)
    .max(NOTEBOOK_INK_POINT_STRIDE * NOTEBOOK_INK_MAX_POINTS)
    .refine(
      (points) => points.length % NOTEBOOK_INK_POINT_STRIDE === 0,
      "invalid_point_stride",
    )
    /*
     * `coordSchema` guards x and y, but every third slot is pressure and the outline algorithm
     * multiplies the nib width by it — a crafted 5000 would ask the renderer for a polygon the
     * size of a city. The coordinates themselves stay deliberately loose (a stroke may run off
     * the page edge, same as an item), so only this slot needs the tighter range.
     */
    .refine(
      (points) =>
        points.every(
          (value, index) =>
            index % NOTEBOOK_INK_POINT_STRIDE !== 2 ||
            (value >= 0 && value <= 1),
        ),
      "invalid_pressure",
    ),
});

export const notebookPageDocSchema = z
  .object({
    version: z.literal(1),
    paper: z.enum(NOTEBOOK_PAPERS),
    items: z.array(notebookPageItemSchema).max(NOTEBOOK_PAGE_MAX_ITEMS),
    /*
     * Defaulted, not optional, and that default is the whole backward-compatibility story: every
     * page written before drawing existed parses into a document with empty ink, so no migration
     * and no `version` bump. Readers downstream can treat `ink` as always present.
     */
    ink: z
      .array(notebookInkStrokeSchema)
      .max(NOTEBOOK_PAGE_MAX_STROKES)
      .default([]),
  })
  .superRefine((doc, ctx) => {
    const entries = doc.items.filter((item) => item.kind === "entry");
    if (entries.length > NOTEBOOK_PAGE_MAX_ENTRIES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "too_many_entries",
        path: ["items"],
      });
    }
    // Duplicate ids would make selection and undo target the wrong element.
    if (new Set(doc.items.map((item) => item.id)).size !== doc.items.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate_item_id",
        path: ["items"],
      });
    }
    // The same entry twice on one page renders two cards for one mistake, and a review tap would
    // update only whichever the pointer hit.
    const entryIds = entries.map((item) => item.entryId);
    if (new Set(entryIds).size !== entryIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate_entry_ref",
        path: ["items"],
      });
    }
    /*
     * The real size guard. `max(NOTEBOOK_PAGE_MAX_STROKES)` alone lets 200 strokes × 400 samples
     * through, which is an order of magnitude more document than the autosave should be shipping.
     */
    const points = doc.ink.reduce(
      (total, stroke) => total + stroke.points.length / NOTEBOOK_INK_POINT_STRIDE,
      0,
    );
    if (points > NOTEBOOK_INK_MAX_TOTAL_POINTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ink_budget_exceeded",
        path: ["ink"],
      });
    }
    // Same reason as `duplicate_item_id`: the eraser removes by id, and a duplicate makes one
    // wipe take a stroke the user did not touch.
    if (new Set(doc.ink.map((stroke) => stroke.id)).size !== doc.ink.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate_stroke_id",
        path: ["ink"],
      });
    }
  });
export type NotebookPageDocInput = z.infer<typeof notebookPageDocSchema>;

export const notebookPageIndexSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(NOTEBOOK_MAX_PAGES - 1);

export const putNotebookPageSchema = z.object({ doc: notebookPageDocSchema });
export type PutNotebookPageInput = z.infer<typeof putNotebookPageSchema>;

/**
 * Subject/topic are optional at creation: the student may add the photo first and label it after,
 * and a free user labels it by hand while a premium one gets it pre-filled. What is NOT optional is
 * `errorType` — it is the single field the whole feature exists to collect.
 */
export const createNotebookEntrySchema = z.object({
  examId: z.string().uuid(),
  source: z.enum(NOTEBOOK_SOURCES).default("OWN"),
  /** Set when the entry starts from a community question the user also could not solve. */
  communityThreadId: z.string().uuid().nullish(),
  mockExamId: z.string().uuid().nullish(),
  storageKey: notebookStorageKeySchema.nullish(),
  subjectRef: z.string().trim().min(1).max(120).nullish(),
  topicRef: z.string().trim().min(1).max(120).nullish(),
  errorType: z.enum(NOTEBOOK_ERROR_TYPES),
  note: z.string().trim().max(NOTEBOOK_NOTE_MAX_LENGTH).nullish(),
  /** The answer, as the student recorded it. Both halves optional and independent of each other. */
  solutionStorageKey: notebookStorageKeySchema.nullish(),
  solutionNote: z.string().trim().max(NOTEBOOK_NOTE_MAX_LENGTH).nullish(),
});
export type CreateNotebookEntryInput = z.infer<
  typeof createNotebookEntrySchema
>;

export const updateNotebookEntrySchema = z
  .object({
    subjectRef: z.string().trim().min(1).max(120).nullish(),
    topicRef: z.string().trim().min(1).max(120).nullish(),
    errorType: z.enum(NOTEBOOK_ERROR_TYPES).optional(),
    note: z.string().trim().max(NOTEBOOK_NOTE_MAX_LENGTH).nullish(),
    /** Patchable during review: the answer is usually learned at the moment the card catches you. */
    solutionStorageKey: notebookStorageKeySchema.nullish(),
    solutionNote: z.string().trim().max(NOTEBOOK_NOTE_MAX_LENGTH).nullish(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "empty_patch" });
export type UpdateNotebookEntryInput = z.infer<
  typeof updateNotebookEntrySchema
>;

/**
 * Link an existing entry to the forum thread the user just asked it in.
 *
 * The client creates the thread through the forum's own API and posts the id here, rather than
 * coaching creating threads: a coaching service reaching into forum would be the cross-context call
 * the module rules forbid, and the forum already owns every rule about what a question may contain.
 */
export const linkNotebookThreadSchema = z.object({
  threadId: z.string().uuid(),
});
export type LinkNotebookThreadInput = z.infer<typeof linkNotebookThreadSchema>;

/** The review answer. One boolean — "could you do it this time?" — and the ladder does the rest. */
export const reviewNotebookEntrySchema = z.object({ solved: z.boolean() });
export type ReviewNotebookEntryInput = z.infer<
  typeof reviewNotebookEntrySchema
>;

/**
 * No idempotency key, unlike the mock-exam categorize: a pre-label is a suggestion the user is
 * about to overwrite anyway, nothing persists it, and there is no row to dedupe against. The cost
 * of a retry is one quota unit, which is cheaper than a table that exists only to save one.
 */
export const prelabelNotebookEntrySchema = z.object({
  storageKey: notebookStorageKeySchema,
  examId: z.string().uuid(),
});
export type PrelabelNotebookEntryInput = z.infer<
  typeof prelabelNotebookEntrySchema
>;

