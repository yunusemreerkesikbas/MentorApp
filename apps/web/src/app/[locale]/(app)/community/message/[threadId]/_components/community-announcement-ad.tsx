"use client";
import { AdPlacementId, type ThreadDetail } from "@mentor/types";
import { DeferredContextualAdSlot } from "@/components/ads/deferred-contextual-ad-slot";
import { useCommunityAdSuppression } from "../../../_components/use-community-ad-suppression";
import { useCommunitySidebarMatches } from "../../../_components/community-sidebar-snapshot";

export function CommunityAnnouncementAd({ threadId, context }: { threadId: string; context: ThreadDetail["adContext"] }) {
  const suppressed = useCommunityAdSuppression();
  const sidebarMatches = useCommunitySidebarMatches(context?.sidebarRooms);
  if (!context || !sidebarMatches || suppressed) return null;
  return <DeferredContextualAdSlot key={context.contentRevision} placementId={AdPlacementId.COMMUNITY_ANNOUNCEMENT_END}
    announcement={{ threadId, contentRevision: context.contentRevision }} />;
}
