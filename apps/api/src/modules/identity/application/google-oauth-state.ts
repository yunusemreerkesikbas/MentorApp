import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const commonState = {
  nonce: z.string().min(16),
  locale: z.enum(["tr", "en"]),
  returnTo: z.string(),
  expiresAt: z.number().finite(),
};

const stateSchema = z.discriminatedUnion("mode", [
  z.object({ ...commonState, mode: z.literal("login"), kvkkAccepted: z.boolean() }),
  z.object({ ...commonState, mode: z.literal("signup"), kvkkAccepted: z.boolean() }),
  z.object({
    ...commonState,
    mode: z.literal("link"),
    userId: z.string().uuid(),
    sessionId: z.string().uuid(),
  }),
]);

export type GoogleOAuthState = z.infer<typeof stateSchema>;
export type GoogleLinkState = Extract<GoogleOAuthState, { mode: "link" }>;

export function signGoogleOAuthState(state: GoogleOAuthState, secret: string): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

export function verifyGoogleOAuthState(
  cookieValue: string | undefined,
  secret: string,
): GoogleOAuthState | null {
  if (!cookieValue) return null;
  const [body, signature, extra] = cookieValue.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmac(body, secret));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const parsed = stateSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function hmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}
