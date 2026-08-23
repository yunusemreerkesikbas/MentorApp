import { describe, expect, it } from "vitest";

import {
  APP_SIDEBAR_BOOTSTRAP_SCRIPT,
  APP_SIDEBAR_COLLAPSED_PX,
  APP_SIDEBAR_COLLAPSED_VALUE,
  APP_SIDEBAR_COOKIE,
  APP_SIDEBAR_EXPANDED_PX,
  DEFAULT_APP_SIDEBAR_OPEN,
  isBoardEditorPath,
  isCommunityPath,
  isDefaultCollapsedSidebarPath,
  parseAppSidebarCookie,
} from "./app-sidebar";

describe("parseAppSidebarCookie", () => {
  it("defaults to expanded when the cookie is missing", () => {
    expect(parseAppSidebarCookie(undefined)).toBe(DEFAULT_APP_SIDEBAR_OPEN);
    expect(parseAppSidebarCookie(null)).toBe(true);
    expect(parseAppSidebarCookie("")).toBe(true);
    expect(parseAppSidebarCookie("other=1")).toBe(true);
  });

  it("collapses only from an exact mentor-sidebar value", () => {
    expect(parseAppSidebarCookie("mentor-sidebar=collapsed")).toBe(false);
    expect(parseAppSidebarCookie("locale=tr; mentor-sidebar=collapsed; other=1")).toBe(
      false,
    );
    expect(parseAppSidebarCookie("mentor-sidebar=expanded")).toBe(true);
    expect(parseAppSidebarCookie("mentor-sidebar=COLLAPSED")).toBe(true);
  });
});

describe("isBoardEditorPath", () => {
  it("matches canonical and public board editor URLs", () => {
    expect(isBoardEditorPath("/vision-board/board")).toBe(true);
    expect(isBoardEditorPath("/hedef/pano")).toBe(true);
    expect(isBoardEditorPath("/en/vision-board/board")).toBe(true);
    expect(isBoardEditorPath("/vision-board")).toBe(false);
    expect(isBoardEditorPath("/hedef")).toBe(false);
  });
});

describe("isCommunityPath", () => {
  it("matches canonical and public community URLs", () => {
    expect(isCommunityPath("/community")).toBe(true);
    expect(isCommunityPath("/community/feed")).toBe(true);
    expect(isCommunityPath("/topluluk")).toBe(true);
    expect(isCommunityPath("/en/topluluk/akis")).toBe(true);
    expect(isCommunityPath("/dashboard")).toBe(false);
  });
});

describe("isDefaultCollapsedSidebarPath", () => {
  it("collapses the desktop AppNav on the board editor and community", () => {
    expect(isDefaultCollapsedSidebarPath("/hedef/pano")).toBe(true);
    expect(isDefaultCollapsedSidebarPath("/community")).toBe(true);
    expect(isDefaultCollapsedSidebarPath("/plan")).toBe(false);
  });
});

describe("APP_SIDEBAR_BOOTSTRAP_SCRIPT", () => {
  it("applies data-app-sidebar from the cookie, board editor, or community path", () => {
    expect(APP_SIDEBAR_BOOTSTRAP_SCRIPT).toContain(APP_SIDEBAR_COOKIE);
    expect(APP_SIDEBAR_BOOTSTRAP_SCRIPT).toContain(`==="${APP_SIDEBAR_COLLAPSED_VALUE}"`);
    expect(APP_SIDEBAR_BOOTSTRAP_SCRIPT).toContain("dataset.appSidebar");
    expect(APP_SIDEBAR_BOOTSTRAP_SCRIPT).toContain("hedef\\/pano");
    expect(APP_SIDEBAR_BOOTSTRAP_SCRIPT).toContain("community|topluluk");
  });
});

describe("app sidebar widths", () => {
  it("keeps the collapsed strip on the analysis-rail width", () => {
    expect(APP_SIDEBAR_EXPANDED_PX).toBe(240);
    expect(APP_SIDEBAR_COLLAPSED_PX).toBe(52);
  });
});
