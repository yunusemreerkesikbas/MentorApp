import type { Page, Route } from "@playwright/test";
import type { AnswerView, ForumFeedItem, QuestionDetail, ZoneView } from "@mentor/types";
import { mockOverviewAds } from "./overview-ads";

export const QUESTION_ID = "11111111-1111-4111-8111-111111111111";
const zoneId = "33333333-3333-4333-8333-333333333333";
const authorId = "22222222-2222-4222-8222-222222222222";
const createdAt = "2026-10-01T00:00:00Z";
export const QUESTION_PATH = `/topluluk/soru/${QUESTION_ID}`;

export async function mockCommunityQuestionAds(page: Page,
  options: Parameters<typeof mockOverviewAds>[1] & { reviewed?: boolean; legacy?: boolean; loadError?: boolean; long?: boolean } = {}) {
  const ads = await mockOverviewAds(page, { examType: "YKS", ...options });
  const zone: ZoneView = { id: zoneId, type: "QA", title: "Soru ve Cevap", slug: "soru-cevap", description: null, visibility: "PUBLIC",
    joinPolicy: "OPEN", examType: "YKS", isArchived: false, memberCount: 5, threadCount: 3, myStatus: "ACTIVE", myRole: "MEMBER", canModerate: false, createdAt };
  const answer: AnswerView = { id: "44444444-4444-4444-8444-444444444444", threadId: QUESTION_ID,
    authorId: "55555555-5555-4555-8555-555555555555", authorName: "Destek Veren", authorUsername: "destek", authorAvatarUrl: null,
    body: "Küçük adımlarla ilerleyebilirsin.", isAccepted: false, attachments: [], myBookmarked: false, createdAt };
  const detail: QuestionDetail = { question: { id: QUESTION_ID, zoneId, authorId, authorName: "Soru Sahibi", authorUsername: "sahip", authorAvatarUrl: null,
    title: "Çalışma düzenimi nasıl sürdürebilirim?", body: options.long ? "Her gün küçük bir adım atıyorum.\n\n".repeat(90) : "Her gün küçük bir adımla ilerlemek istiyorum.",
    poll: null, status: "OPEN", acceptedPostId: null, isPinned: false, reactionCounts: {}, myReactions: [], commentCount: 1,
    commenterNames: [], attachments: [], myBookmarked: false, tags: [], coachBridge: null, createdAt }, answers: [answer] };
  const waiting: ForumFeedItem = { ...detail.question, id: "66666666-6666-4666-8666-666666666666", title: "Tekrarları nasıl düzenleyebilirim?",
    zone: { id: zoneId, type: "QA", title: zone.title, slug: zone.slug },
    author: { id: answer.authorId, displayName: answer.authorName, username: "destek", avatarUrl: null }, tags: [], helpfulVoteCount: 0,
    myHelpfulVote: false, capabilities: { canEdit: false, canDelete: false, canModerate: false, editDeadline: null },
    lastActivityAt: createdAt, editedAt: null, score: 0 };
  const state = { ads, detail, zone, feedRequests: 0, answerPosts: 0, revision: options.reviewed === false ? null : "b".repeat(64) as string | null };
  await page.route("**/v1/forum/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") return json(route, null, 204);
    if (path === "/v1/forum/zones") return json(route, { items: [zone], total: 1, page: 1, pageSize: 100 });
    if (path === `/v1/forum/threads/${QUESTION_ID}`) {
      if (options.loadError) return json(route, { code: "SERVICE_UNAVAILABLE", message: "Soru şu anda yüklenemiyor." }, 503);
      return json(route, { ...state.detail, pageContext: options.legacy ? undefined : {
        zone: { id: zoneId, title: zone.title, slug: zone.slug }, waitingQuestions: [waiting], adContentRevision: state.revision,
      } });
    }
    if (path === `/v1/forum/threads/${QUESTION_ID}/answers`) {
      state.answerPosts++;
      const posted = { ...answer, id: "77777777-7777-4777-8777-777777777777", body: route.request().postDataJSON().body as string };
      state.detail.answers.push(posted); state.revision = null;
      return json(route, posted, 201);
    }
    if (path.includes("/accept/")) {
      answer.isAccepted = true; state.detail.question.acceptedPostId = answer.id; state.detail.question.status = "ANSWERED"; state.revision = null;
      return json(route, { status: "ok" });
    }
    if (path === "/v1/forum/feed") { state.feedRequests++; return json(route, { items: [waiting], nextCursor: null, context: { activeThreads: [], suggestedThreads: [] } }); }
    if (path === "/v1/forum/tags") return json(route, []);
    return json(route, null, 204);
  });
  return state;
}

async function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", headers: {
    "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3370",
    "access-control-allow-credentials": "true",
  }, body: body === null ? "" : JSON.stringify(body) });
}
