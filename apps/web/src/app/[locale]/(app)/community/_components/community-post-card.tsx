"use client";

import type { ComponentProps } from "react";

import { ThreadItem } from "../[slug]/_components/thread-item";

/**
 * Canonical community thread renderer. Feed, room, profile and saved surfaces must compose this
 * component instead of creating a second post layout; data mutations remain owned by each shell.
 */
export function CommunityPostCard(props: ComponentProps<typeof ThreadItem>) {
  return <ThreadItem {...props} />;
}
