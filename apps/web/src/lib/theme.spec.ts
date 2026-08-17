import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_COOKIE,
  parseThemeCookie,
} from "./theme";

describe("parseThemeCookie", () => {
  it("defaults to light when the cookie is missing", () => {
    expect(parseThemeCookie(undefined)).toBe(DEFAULT_THEME);
    expect(parseThemeCookie(null)).toBe("light");
    expect(parseThemeCookie("")).toBe("light");
    expect(parseThemeCookie("other=1")).toBe("light");
  });

  it("reads dark only from an exact mentor-theme value", () => {
    expect(parseThemeCookie("mentor-theme=dark")).toBe("dark");
    expect(parseThemeCookie("locale=tr; mentor-theme=dark; other=1")).toBe("dark");
    expect(parseThemeCookie("mentor-theme=light")).toBe("light");
    expect(parseThemeCookie("mentor-theme=system")).toBe("light");
    expect(parseThemeCookie("mentor-theme=DARK")).toBe("light");
  });
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
  it("applies html.dark from the same cookie name", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_COOKIE);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('==="dark"');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('classList.add("dark")');
  });
});
