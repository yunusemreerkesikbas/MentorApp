/**
 * Auth schemas — shared FE+BE (§8 single validation source).
 * Field copy is NOT here: messages are localized by the backend (error pipeline).
 */
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Min 8 chars; at least one letter and one digit (pragmatic MVP policy). */
export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-zA-Z]/)
  .regex(/[0-9]/);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(64),
  /** Optional at API level for /v1 backward compatibility; web signup requires it. */
  username: usernameSchema.optional(),
  /** KVKK consent is mandatory at signup (roadmap §7/§9). */
  kvkkAccepted: z.literal(true),
  /** Cloudflare Turnstile token (enforced when the secret is configured). */
  turnstileToken: z.string().optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const googleOAuthStartQuerySchema = z
  .object({
    mode: z.enum(["login", "signup"]).default("login"),
    locale: z.enum(["tr", "en"]).default("tr"),
    returnTo: z
      .string()
      .regex(/^\/(?!\/)[a-z0-9/_-]*$/i)
      .default("/panel"),
    kvkkAccepted: z.enum(["true"]).optional(),
  })
  .refine((v) => v.mode !== "signup" || v.kvkkAccepted === "true", {
    path: ["kvkkAccepted"],
    message: "required",
  });
export type GoogleOAuthStartQuery = z.infer<typeof googleOAuthStartQuerySchema>;

export const googleOAuthCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(16),
  error: z.string().min(1).max(128).optional(),
});
export type GoogleOAuthCallbackQuery = z.infer<typeof googleOAuthCallbackQuerySchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(16) });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Empty / whitespace-only strings clear the field (→ null); real values are validated. */
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(2).max(64).optional(),
    username: usernameSchema.optional(),
    avatarStorageKey: z.string().trim().min(1).max(512).nullable().optional(),
    /** Public profile self-description (community surface); empty clears it. */
    bio: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()).optional(),
    /** Public personal link (http/https); empty clears it. */
    website: z.preprocess(emptyToNull, z.string().trim().url().max(200).nullable()).optional(),
    examType: z.enum(["KPSS", "YKS", "LGS"]).optional(),
    /**
     * KPSS guide level. Only meaningful with `examType: "KPSS"`; the service clears it for any
     * other family rather than trusting the client to keep the pair consistent.
     */
    examVariant: z
      .enum(["LISANS", "ONLISANS", "ORTAOGRETIM"])
      .nullable()
      .optional(),
    /** ISO date (yyyy-mm-dd) of the target exam — must be a real calendar date. */
    examDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && s === new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10))
      .optional(),
    /** Daily focus goal in minutes (15-min steps); null clears the goal. */
    dailyFocusGoalMinutes: z
      .number()
      .int()
      .min(15)
      .max(600)
      .multipleOf(15)
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty" });
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const avatarUploadUrlSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png"]),
});
export type AvatarUploadUrlInput = z.infer<typeof avatarUploadUrlSchema>;
