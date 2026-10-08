import type { ZoneType } from "@mentor/types";

/** A question opens its Q&A page; a chat or announcement post opens its message page. */
export function threadHref(item: { id: string; zone: { type: ZoneType } }) {
  return item.zone.type === "QA"
    ? ({ pathname: "/community/question/[threadId]", params: { threadId: item.id } } as const)
    : ({ pathname: "/community/message/[threadId]", params: { threadId: item.id } } as const);
}
