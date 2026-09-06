import { z } from "zod";

/** Linking always confirms the current password, even in an authenticated session. */
export const googleLinkStartSchema = z.object({
  password: z.string().min(1).max(128),
  locale: z.enum(["tr", "en"]).default("tr"),
});
export type GoogleLinkStartInput = z.infer<typeof googleLinkStartSchema>;
