/** Code-owned exam families. Calendar editions and scoring rules remain editorial content. */
export const ExamVariant = {
  LISANS: "LISANS",
  ONLISANS: "ONLISANS",
  ORTAOGRETIM: "ORTAOGRETIM",
} as const;
export type ExamVariant = (typeof ExamVariant)[keyof typeof ExamVariant];
export const EXAM_VARIANTS = Object.values(ExamVariant) as [ExamVariant, ...ExamVariant[]];

/** Insertion order is the shared selection order. Add only families with prepared content. */
export const EXAM_CATALOG = {
  KPSS: { variants: EXAM_VARIANTS },
  YKS: { variants: [] },
  LGS: { variants: [] },
  ALES: { variants: [] },
  DGS: { variants: [] },
} as const satisfies Record<string, { variants: readonly ExamVariant[] }>;

export type ExamType = keyof typeof EXAM_CATALOG;

/** Preserve the existing ExamType.KPSS API while deriving every code from the catalogue. */
export const ExamType = Object.fromEntries(
  Object.keys(EXAM_CATALOG).map((code) => [code, code]),
) as { readonly [Code in ExamType]: Code };

export const EXAM_TYPES = Object.keys(EXAM_CATALOG) as [ExamType, ...ExamType[]];
