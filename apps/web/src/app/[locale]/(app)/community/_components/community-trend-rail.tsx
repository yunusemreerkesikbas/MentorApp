"use client";

import { useEffect, useState } from "react";
import type { ForumTrendsView } from "@mentor/types";
import { getForumTrends } from "@/lib/forum";
import { HubTrends } from "./hub-rail";

/**
 * "Popüler etiketler" on the Akış and room rails. Tags are optional on posts, so trends are often empty: then,
 * and while loading or after an error, there is no card at all (DESIGN.md §10).
 */
export function CommunityTrendRail() {
  const [items, setItems] = useState<ForumTrendsView["items"]>([]);

  useEffect(() => {
    let active = true;
    getForumTrends("relevant", 5)
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return <HubTrends tags={items} />;
}
