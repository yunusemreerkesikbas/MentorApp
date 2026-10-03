import { z } from "zod";

/** Only explicitly allowed separators are stripped; foreign/fixed-line numbers are rejected. */
export const turkeyMobilePhoneSchema = z.string().trim().min(10).max(32)
  .regex(/^[+\d ()-]+$/)
  .transform((input) => input.replace(/[ ()-]/g, ""))
  .transform((input) => {
    if (/^05\d{9}$/.test(input)) return `+90${input.slice(1)}`;
    if (/^5\d{9}$/.test(input)) return `+90${input}`;
    if (/^905\d{9}$/.test(input)) return `+${input}`;
    return input;
  })
  .pipe(z.string().regex(/^\+905\d{9}$/));

export const phoneVerificationRequestSchema = z.object({
  phoneNumber: turkeyMobilePhoneSchema,
  turnstileToken: z.string().max(2048).optional(),
});
export const phoneVerificationConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
export const phoneVerificationParamsSchema = z.object({ challengeId: z.string().uuid() });
export type PhoneVerificationRequestInput = z.infer<typeof phoneVerificationRequestSchema>;
export type PhoneVerificationConfirmInput = z.infer<typeof phoneVerificationConfirmSchema>;
