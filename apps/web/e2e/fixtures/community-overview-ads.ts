import type { Page, Route } from "@playwright/test";
import type { BuddyViewDto, ForumFeedItem, ForumHubView } from "@mentor/types";
import { mockCommunityQuestionAds } from "./community-question-ads";

export async function mockDiscoveryAds(page: Page, options: Parameters<typeof mockCommunityQuestionAds>[1] & {
  closed?: boolean; history?: boolean; buddy?: boolean; buddyError?: boolean; hubError?: boolean;
} = {}) {
  const state = await mockCommunityQuestionAds(page, options);
  const q = state.detail.question;
  const featured: ForumFeedItem = { ...q, title: "Toplulukta birlikte ilerliyoruz",
    tags: q.tags ?? [],
    zone: { id: q.zoneId, title: "Soru ve Cevap", slug: "soru-cevap", type: "QA" },
    author: { id: q.authorId, displayName: q.authorName, username: q.authorUsername ?? "sahip", avatarUrl: null },
    helpfulVoteCount: 0, myHelpfulVote: false, score: 0, editedAt: null, lastActivityAt: q.createdAt,
    capabilities: { canEdit: false, canDelete: false, canModerate: false, editDeadline: null } };
  const hub: ForumHubView = { featured, continueDiscussions: options.history ? [featured] : [],
    recommendedZones: [], supporters: [{ id: q.authorId, displayName: "El Uzatan", username: "destek", avatarUrl: null }],
    trendingTags: [], adContext: options.closed || options.history ? undefined : { contentRevision: "c".repeat(64), waitingQuestions: [], sidebarRooms: [state.zone], examType: "YKS" } };
  const buddy: BuddyViewDto = { active: null, outgoing: null, incoming: options.buddy ? [{ id: "88888888-8888-4888-8888-888888888888",
    partner: { userId: q.authorId, displayName: "Özel Yol Arkadaşım", username: "ozel", avatarUrl: null }, createdAt: q.createdAt }] : [] };
  const api = { state, hub, buddyHold: null as Promise<void> | null, buddyRequests: 0 };
  await page.route("**/v1/forum/hub", (route) => options.hubError
    ? json(route, { code: "SERVICE_UNAVAILABLE", message: "Topluluk şu anda yüklenemiyor." }, 503) : json(route, hub));
  await page.route("**/v1/buddy", async (route) => {
    api.buddyRequests++; await api.buddyHold;
    return options.buddyError ? json(route, { code: "SERVICE_UNAVAILABLE", message: "Unavailable" }, 503) : json(route, buddy);
  });
  return api;
}
async function json(route: Route, body: unknown, status = 200) {
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3370", "access-control-allow-credentials": "true" } });
  return route.fulfill({ status, contentType: "application/json", headers: {
    "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3370", "access-control-allow-credentials": "true",
  }, body: JSON.stringify(body) });
}
