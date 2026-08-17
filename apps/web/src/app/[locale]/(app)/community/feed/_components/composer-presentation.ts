import type { ComposerAudienceMode } from "../../_components/composer-audience";

export function getComposerPresentation({
  expanded,
  mode,
  hasPoll,
}: {
  expanded: boolean;
  mode: ComposerAudienceMode;
  hasPoll: boolean;
}) {
  return {
    showAudience: expanded,
    showTypeSelector: expanded,
    showBody: !hasPoll && mode === "share",
    showQuestionTitle: false,
    showPollTitle: expanded && hasPoll,
  };
}

export function shouldCollapseComposerOnOutside({
  mode,
  hasPoll,
  busy,
}: {
  mode: ComposerAudienceMode;
  hasPoll: boolean;
  busy: boolean;
}): boolean {
  return mode === "share" && !hasPoll && !busy;
}
