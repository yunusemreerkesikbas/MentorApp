import type { Page, Route } from "@playwright/test";
import type { CommentView, ThreadDetail, ZoneView } from "@mentor/types";
import { mockCommunityQuestionAds } from "./community-question-ads";

export const ANNOUNCEMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const ANNOUNCEMENT_PATH = `/topluluk/mesaj/${ANNOUNCEMENT_ID}`;
export async function mockAnnouncementAds(page: Page, options: Parameters<typeof mockCommunityQuestionAds>[1] & {
  unreviewed?: boolean; chat?: boolean; privateRoom?: boolean; privateSidebar?: boolean; nested?: boolean;
} = {}) {
  const base = await mockCommunityQuestionAds(page, options);
  const zone: ZoneView = { ...base.zone, type: options.chat ? "CHAT" : "ANNOUNCEMENT", title: "Duyurular", slug: "duyurular", visibility: options.privateRoom ? "PRIVATE" : "PUBLIC" };
  const comment: CommentView = { ...base.detail.answers[0]!, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", threadId: ANNOUNCEMENT_ID,
    parentPostId: null, body: "Görünür duyuru yorumu.", replyCount: options.nested ? 1 : 0, reactionCounts: {}, myReactions: [] };
  const detail: ThreadDetail = { thread: { ...base.detail.question, id: ANNOUNCEMENT_ID, title: null, body: "Bu haftanın topluluk duyurusu.",
    capabilities: { canEdit: true, canDelete: true, canModerate: false, editDeadline: "2035-01-01T00:00:00Z" } }, comments: [comment],
    adContext: options.unreviewed || options.chat || options.privateRoom ? undefined : { contentRevision: "d".repeat(64), zone, sidebarRooms: [zone] } };
  const state = { base, detail, zone, commentPosts: 0 };
  await page.route("**/v1/forum/zones?**", (route) => json(route, { items: [zone, ...(options.privateSidebar ? [{ ...zone,
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Özel odam", slug: "ozel", visibility: "PRIVATE" }] : [])], total: options.privateSidebar ? 2 : 1, page: 1, pageSize: 100 }));
  await page.route(`**/v1/forum/threads/${ANNOUNCEMENT_ID}/detail`, (route) => options.loadError
    ? json(route, { code: "SERVICE_UNAVAILABLE", message: "Duyuru şu anda yüklenemiyor." }, 503) : json(route, state.detail));
  await page.route(`**/v1/forum/threads/${ANNOUNCEMENT_ID}/comments`, (route) => {
    state.commentPosts++;
    const posted: CommentView = { ...comment, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", body: route.request().postDataJSON().body as string };
    state.detail.comments.push(posted); state.detail.adContext = undefined;
    return json(route, posted, 201);
  });
  await page.route(`**/v1/forum/posts/${comment.id}`, (route) => json(route, { comment,
    replies: [{ ...comment, id: "ffffffff-ffff-4fff-8fff-ffffffffffff", parentPostId: comment.id, body: "Gizli alt yanıt açıldı." }], zoneId: zone.id }));
  return state;
}
async function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status: route.request().method() === "OPTIONS" ? 204 : status, contentType: "application/json", headers: {
    "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3370", "access-control-allow-credentials": "true",
  }, body: route.request().method() === "OPTIONS" ? "" : JSON.stringify(body) });
}
