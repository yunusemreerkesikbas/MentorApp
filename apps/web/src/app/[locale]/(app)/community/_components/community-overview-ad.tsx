"use client";
import { AdPlacementId, type ZoneView } from "@mentor/types";
import { DeferredContextualAdSlot } from "@/components/ads/deferred-contextual-ad-slot";
import { useCommunityAdSuppression } from "./use-community-ad-suppression";
import { useCommunitySidebarMatches } from "./community-sidebar-snapshot";

export function CommunityOverviewAd({ contentRevision, buddySafe, sidebarRooms }: { contentRevision?: string; buddySafe: boolean; sidebarRooms?: ZoneView[] }) {
  const suppressed = useCommunityAdSuppression();
  const sidebarMatches = useCommunitySidebarMatches(sidebarRooms);
  if (!contentRevision || !buddySafe || !sidebarMatches || suppressed) return null;
  return <DeferredContextualAdSlot key={contentRevision} placementId={AdPlacementId.COMMUNITY_OVERVIEW} hubRevision={contentRevision} />;
}
