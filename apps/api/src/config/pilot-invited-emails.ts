import { z } from "zod";
import { emailSchema } from "@mentor/validation";

/** Private API environment input. Do not put addresses in the audited config registry. */
export const pilotInvitedEmailsSchema = z.string().default("")
  .transform((value) => value.trim() === "" ? [] : value.split(","))
  .pipe(z.array(emailSchema))
  .superRefine((emails, context) => {
    if (new Set(emails).size !== emails.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate invitation entries are not allowed." });
    }
  });
