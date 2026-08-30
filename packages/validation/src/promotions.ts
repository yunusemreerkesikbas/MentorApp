/**
 * Promotions schemas (W4) — shared FE+BE.
 *
 * NOTE: import from the leaf module, NOT "./index.js" — a barrel import here would create an
 * index↔promotions cycle that crashes sync ESM-from-CJS loading (see the payments gotcha).
 */
import { z } from "zod";

/** Shared, shareable, case-insensitive at rest — normalized to upper case on the way in. */
export const promotionCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(32)
  .regex(/^[A-Z0-9-]+$/, "A coupon code may contain only letters, digits and hyphens.");

export const promotionRuleTypeSchema = z.enum([
  "ANYONE",
  "NEW_USER",
  "ACTIVE_DAYS",
  "WIN_BACK",
]);
export const promotionDiscountTypeSchema = z.enum(["PERCENT", "FIXED"]);

/** Shape depends on `ruleType`; the pairing is enforced by `refinePromotion` below. */
export const promotionRuleParamsSchema = z.union([
  z.object({}).strict(),
  z.object({ withinDays: z.number().int().min(1).max(365) }).strict(),
  z
    .object({
      days: z.number().int().min(1).max(31),
      windowDays: z.number().int().min(1).max(90),
    })
    .strict(),
]);

/** POST /v1/subscription/offers — omit `code` for the automatically applied offer. */
export const promotionOffersSchema = z.object({
  code: promotionCodeSchema.optional(),
});
export type PromotionOffersInput = z.infer<typeof promotionOffersSchema>;

const promotionFields = {
  /** null = applied automatically, no code to type. */
  code: promotionCodeSchema.nullish(),
  name: z.string().trim().min(1).max(80),
  labelTr: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().min(1).max(60),
  ruleType: promotionRuleTypeSchema,
  ruleParams: promotionRuleParamsSchema.default({}),
  discountType: promotionDiscountTypeSchema,
  /** PERCENT → 1..90 (refined below) · FIXED → kuruş. */
  discountValue: z.number().int().positive().max(10_000_000),
  /**
   * Upper bound here is only a sanity rail. The ACTUAL ceiling is the `promotions.max_discount_periods`
   * config key, checked in the service — so it can be raised when the payment adapter can honour
   * multi-period discounts, without a code change or a migration.
   */
  appliesToPeriods: z.number().int().min(1).max(24).default(1),
  /** null = every plan. */
  planIds: z.array(z.string().trim().min(1).max(64)).min(1).max(20).nullish(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  maxRedemptions: z.number().int().positive().max(1_000_000).nullish(),
  maxRedemptionsPerUser: z.number().int().min(1).max(100).default(1),
  isActive: z.boolean().default(true),
};

type PromotionShape = {
  ruleType?: z.infer<typeof promotionRuleTypeSchema>;
  ruleParams?: Record<string, unknown>;
  discountType?: z.infer<typeof promotionDiscountTypeSchema>;
  discountValue?: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

/** Cross-field rules that a flat object schema cannot express. */
function refinePromotion(value: PromotionShape, ctx: z.RefinementCtx): void {
  if (
    value.discountType === "PERCENT" &&
    value.discountValue !== undefined &&
    (value.discountValue < 1 || value.discountValue > 90)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountValue"],
      message: "A percentage discount must be between 1 and 90.",
    });
  }

  const params = value.ruleParams ?? {};
  if (value.ruleType === "NEW_USER" && typeof params.withinDays !== "number") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ruleParams"],
      message: "NEW_USER requires { withinDays }.",
    });
  }
  if (
    value.ruleType === "ACTIVE_DAYS" &&
    (typeof params.days !== "number" || typeof params.windowDays !== "number")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ruleParams"],
      message: "ACTIVE_DAYS requires { days, windowDays }.",
    });
  }
  if (
    value.ruleType === "ACTIVE_DAYS" &&
    typeof params.days === "number" &&
    typeof params.windowDays === "number" &&
    params.days > params.windowDays
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ruleParams"],
      message: "`days` cannot exceed `windowDays`.",
    });
  }

  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "endsAt must be after startsAt.",
    });
  }
}

export const adminCreatePromotionSchema = z
  .object(promotionFields)
  .superRefine(refinePromotion);
export type AdminCreatePromotionInput = z.infer<typeof adminCreatePromotionSchema>;

export const adminUpdatePromotionSchema = z
  .object(promotionFields)
  .partial()
  .superRefine(refinePromotion)
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
export type AdminUpdatePromotionInput = z.infer<typeof adminUpdatePromotionSchema>;
