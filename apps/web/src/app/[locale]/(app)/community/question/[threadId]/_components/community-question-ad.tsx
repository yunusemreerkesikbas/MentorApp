"use client";

import { AdPlacementId } from "@mentor/types";
import { DeferredContextualAdSlot } from "@/components/ads/deferred-contextual-ad-slot";
import { useCommunityAdSuppression } from "../../../_components/use-community-ad-suppression";

/** One visit stops advertising as soon as personal editing or a dialog begins. No auto-resume. */
export function CommunityQuestionAd({ questionId, contentRevision }: { questionId: string; contentRevision: string | null | undefined }) {
  const suppressed = useCommunityAdSuppression();

  if (suppressed || !contentRevision) return null;
  return <DeferredContextualAdSlot key={contentRevision} placementId={AdPlacementId.COMMUNITY_QUESTION_END}
    question={{ questionId, contentRevision }} />;
}
