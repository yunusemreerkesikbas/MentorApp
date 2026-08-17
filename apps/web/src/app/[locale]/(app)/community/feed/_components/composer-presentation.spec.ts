import { describe, expect, it } from "vitest";

import {
  getComposerPresentation,
  shouldCollapseComposerOnOutside,
} from "./composer-presentation";

describe("global composer presentation", () => {
  it("keeps the collapsed composer minimal", () => {
    expect(
      getComposerPresentation({ expanded: false, mode: "share", hasPoll: false }),
    ).toEqual({
      showAudience: false,
      showTypeSelector: false,
      showBody: true,
      showQuestionTitle: false,
      showPollTitle: false,
    });
  });

  it("shows separate audience and type controls after focus", () => {
    const view = getComposerPresentation({
      expanded: true,
      mode: "share",
      hasPoll: false,
    });

    expect(view.showAudience).toBe(true);
    expect(view.showTypeSelector).toBe(true);
  });

  it("replaces the body with the poll title for polls", () => {
    expect(
      getComposerPresentation({ expanded: true, mode: "share", hasPoll: true }),
    ).toMatchObject({ showBody: false, showPollTitle: true });
  });

  it("keeps question fields out of the inline composer", () => {
    expect(
      getComposerPresentation({ expanded: true, mode: "question", hasPoll: false }),
    ).toMatchObject({ showBody: false, showQuestionTitle: false, showPollTitle: false });
  });

  it("collapses a standard post when the user clicks outside", () => {
    expect(
      shouldCollapseComposerOnOutside({ mode: "share", hasPoll: false, busy: false }),
    ).toBe(true);
  });

  it("keeps structured and submitting composers expanded", () => {
    expect(
      shouldCollapseComposerOnOutside({ mode: "question", hasPoll: false, busy: false }),
    ).toBe(false);
    expect(
      shouldCollapseComposerOnOutside({ mode: "share", hasPoll: true, busy: false }),
    ).toBe(false);
    expect(
      shouldCollapseComposerOnOutside({ mode: "share", hasPoll: false, busy: true }),
    ).toBe(false);
  });
});
