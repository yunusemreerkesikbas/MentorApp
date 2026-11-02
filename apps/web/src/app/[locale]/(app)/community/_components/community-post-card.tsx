"use client";

import type { ComponentProps } from "react";

import { ThreadItem } from "../[slug]/_components/thread-item";

/**
 * Shared thread renderer for room, profile, saved and message-detail surfaces. Clickable list
 * rows use the same compact media preview as discovery; detail keeps the natural image ratio.
 * Discovery has a separate card for its mixed QA feed; data mutations remain owned by each shell.
 */
export function CommunityPostCard(props: ComponentProps<typeof ThreadItem>) {
  return <ThreadItem {...props} />;
}
