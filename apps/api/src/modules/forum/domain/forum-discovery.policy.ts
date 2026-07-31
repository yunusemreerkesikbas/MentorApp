import { z } from "zod";

export const FORUM_MAX_TAGS = 3;

const TURKISH_ASCII_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

export function normalizeForumTagSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (letter) => TURKISH_ASCII_MAP[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function uniqueForumTagIds(tagIds: string[]): string[] {
  const result = [...new Set(tagIds)];
  if (result.length > FORUM_MAX_TAGS) throw new Error("FORUM_TAG_LIMIT_EXCEEDED");
  return result;
}

export type ForumEditPolicyReason = "FORBIDDEN" | "EXPIRED" | "LOCKED";

export interface ForumEditPolicyResult {
  allowed: boolean;
  reason: ForumEditPolicyReason | null;
  deadline: Date;
}

export function evaluateForumEditPolicy(input: {
  viewerId: string;
  authorId: string;
  createdAt: Date;
  now: Date;
  editWindowMinutes: number;
  interactionCount: number;
}): ForumEditPolicyResult {
  const deadline = new Date(input.createdAt.getTime() + input.editWindowMinutes * 60_000);
  if (input.viewerId !== input.authorId) return { allowed: false, reason: "FORBIDDEN", deadline };
  if (input.now.getTime() > deadline.getTime()) return { allowed: false, reason: "EXPIRED", deadline };
  if (input.interactionCount > 0) return { allowed: false, reason: "LOCKED", deadline };
  return { allowed: true, reason: null, deadline };
}

const feedCursorSchema = z.object({
  version: z.literal(1),
  sort: z.enum(["trending", "recent", "top"]),
  score: z.number().finite(),
  createdAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
  id: z.string().uuid(),
});

export type ForumFeedCursor = z.infer<typeof feedCursorSchema>;

export function encodeForumFeedCursor(
  cursor: Omit<ForumFeedCursor, "version">,
): string {
  return Buffer.from(JSON.stringify({ version: 1, ...cursor }), "utf8").toString("base64url");
}

export function decodeForumFeedCursor(value: string): ForumFeedCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const result = feedCursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function mergeHubDiscussionIds(
  interactedThreadIds: string[],
  relevantThreadIds: string[],
  limit = 4,
): string[] {
  return [...new Set([...interactedThreadIds, ...relevantThreadIds])].slice(0, limit);
}
