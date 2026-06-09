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

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(64),
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

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(16) });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(2).max(64).optional(),
    examType: z.enum(["KPSS", "YKS", "LGS"]).optional(),
    /** ISO date (yyyy-mm-dd) of the target exam — must be a real calendar date. */
    examDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && s === new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10))
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty" });
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
