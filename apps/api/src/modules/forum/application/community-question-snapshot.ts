import { createHash } from "node:crypto";
import { ExamType, type CommunityQuestionAdAuthor, type CommunityQuestionAdSnapshot, type ForumFeedItem, type PublicQuestionView, type QuestionDetail } from "@mentor/types";

export interface PublicReviewZone { id: string; title: string; slug: string; updatedAt: Date }

/** Publisher content only; viewer actions/counts and private coaching are never review material. */
export function buildCommunityQuestionSnapshot(
  published: PublicQuestionView | null, detail: QuestionDetail, zones: PublicReviewZone[], waiting: ForumFeedItem[],
): CommunityQuestionAdSnapshot | null {
  const { question, answers } = detail;
  if (!published?.contentRevision || !published.examType || !Object.values(ExamType).includes(published.examType) ||
    published.id !== question.id || published.body !== question.body || published.title !== (question.title ?? "") ||
    question.coachBridge || question.poll ||
    answers.length === 0 || answers.length !== published.answers.length ||
    !answers.every((answer) => published.answers.some((p) => p.id === answer.id && p.body === answer.body && p.isAccepted === answer.isAccepted))) return null;
  const zone = zones.find((entry) => entry.id === question.zoneId);
  if (!zone || !waiting.every((item) => zones.some((entry) => entry.id === item.zone.id))) return null;
  // Inline Markdown media and non-image files need richer editorial tooling before monetization.
  if ([question, ...answers].some((post) => /!\[|<img\b|<video\b|<iframe\b/i.test(post.body) ||
    post.attachments.some((attachment) => attachment.kind !== "image"))) return null;
  const author = (post: typeof question | (typeof answers)[number]): CommunityQuestionAdAuthor => ({
    id: post.authorId, name: post.authorName, username: post.authorUsername, avatarUrl: post.authorAvatarUrl,
  });
  const snapshot = {
    publicContentRevision: published.contentRevision, examType: published.examType,
    zone: { id: zone.id, title: zone.title, slug: zone.slug },
    question: { id: question.id, title: question.title ?? "", body: question.body, createdAt: question.createdAt,
      author: author(question), attachments: question.attachments, tags: (question.tags ?? []).slice(0, 3).map((tag) => tag.slug) },
    answers: answers.map((a) => ({ id: a.id, body: a.body, isAccepted: a.isAccepted, createdAt: a.createdAt, author: author(a), attachments: a.attachments })),
    waitingQuestions: waiting.map((item) => ({ id: item.id, title: item.title ?? item.body, authorName: item.author.displayName,
      zoneTitle: item.zone.title, zoneSlug: item.zone.slug, createdAt: item.createdAt })),
  };
  const contentRevision = createHash("sha256").update(JSON.stringify({ ...snapshot,
    zoneVersions: zones.map((entry) => [entry.id, entry.updatedAt.toISOString()]).sort((a, b) => a[0]!.localeCompare(b[0]!)),
  })).digest("hex");
  return { ...snapshot, contentRevision };
}
