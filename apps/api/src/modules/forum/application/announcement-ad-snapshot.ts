import { createHash } from "node:crypto";
import { ExamType, type AnnouncementAdPost, type AnnouncementAdSnapshot, type ThreadDetail, type ZoneView } from "@mentor/types";

type PublicRoom = { id: string; updatedAt: Date; examType: string | null };
/** Hash only initially visible publisher content; opening hidden replies ends advertising. */
export function buildAnnouncementAdSnapshot(detail: ThreadDetail, zone: ZoneView, sidebar: ZoneView[], publicRooms: PublicRoom[]): AnnouncementAdSnapshot | null {
  const { thread, comments } = detail;
  if (zone.id !== thread.zoneId || zone.type !== "ANNOUNCEMENT" || zone.visibility !== "PUBLIC" || zone.isArchived ||
    !Object.values(ExamType).includes(zone.examType as ExamType) || !thread.body.trim() || thread.poll || thread.coachBridge ||
    comments.some((comment) => comment.threadId !== thread.id || comment.parentPostId !== null) ||
    sidebar.some((room) => room.visibility !== "PUBLIC" || room.isArchived)) return null;
  const ids = new Set([zone.id, ...sidebar.map((room) => room.id)]);
  if ([...ids].some((id) => !publicRooms.some((room) => room.id === id)) ||
    publicRooms.some((room) => room.examType !== null && !Object.values(ExamType).includes(room.examType as ExamType))) return null;
  if ([thread, ...comments].some((post) => /!\[|<img\b|<video\b|<iframe\b/i.test(post.body) || post.attachments.some((attachment) => attachment.kind !== "image"))) return null;
  const examType = publicRooms.some((room) => room.examType === ExamType.LGS) ? ExamType.LGS
    : publicRooms.some((room) => room.examType === ExamType.YKS) ? ExamType.YKS : zone.examType as ExamType;
  const post = (item: typeof thread | (typeof comments)[number]): AnnouncementAdPost => ({
    id: item.id, body: item.body, createdAt: item.createdAt, editedAt: item.editedAt ?? null, attachments: item.attachments,
    author: { id: item.authorId, name: item.authorName, username: item.authorUsername, avatarUrl: item.authorAvatarUrl },
  });
  const snapshot = { examType, zone, sidebarRooms: sidebar,
    thread: { ...post(thread), title: thread.title, isPinned: thread.isPinned, commenterNames: thread.commenterNames,
      tags: (thread.tags ?? []).slice(0, 3).map(({ slug, name }) => ({ slug, name })) },
    comments: comments.map((comment) => ({ ...post(comment), replyCount: comment.replyCount })),
  };
  const room = (item: ZoneView) => ({ id: item.id, title: item.title, slug: item.slug, type: item.type, examType: item.examType });
  const contentRevision = createHash("sha256").update(JSON.stringify({ ...snapshot, kind: "ANNOUNCEMENT",
    zone: room(zone), sidebarRooms: sidebar.map(room),
    roomVersions: [...publicRooms].sort((a, b) => a.id.localeCompare(b.id)).map((item) => [item.id, item.updatedAt.toISOString(), item.examType]),
  })).digest("hex");
  return { ...snapshot, contentRevision };
}
