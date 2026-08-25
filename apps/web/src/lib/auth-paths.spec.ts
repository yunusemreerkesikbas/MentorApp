import { describe, expect, it } from "vitest";
import { authShellNav, isAuthPath } from "./auth-paths";

describe("isAuthPath", () => {
  it("matches auth route group pathnames", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/signup")).toBe(true);
    expect(isAuthPath("/forgot-password")).toBe(true);
    expect(isAuthPath("/reset-password")).toBe(true);
    expect(isAuthPath("/verify-email")).toBe(true);
    expect(isAuthPath("/")).toBe(false);
    expect(isAuthPath("/dashboard")).toBe(false);
    expect(isAuthPath("/cookie-preferences")).toBe(false);
  });
});

describe("authShellNav", () => {
  it("closes login and signup to home (mobile sheet only)", () => {
    expect(authShellNav("/login")).toEqual({ href: "/", icon: "close" });
    expect(authShellNav("/signup")).toEqual({ href: "/", icon: "close" });
  });

  it("returns nested auth screens to login", () => {
    expect(authShellNav("/forgot-password")).toEqual({
      href: "/login",
      icon: "chevron",
    });
    expect(authShellNav("/reset-password")).toEqual({
      href: "/login",
      icon: "chevron",
    });
    expect(authShellNav("/verify-email")).toEqual({
      href: "/login",
      icon: "chevron",
    });
  });
});
