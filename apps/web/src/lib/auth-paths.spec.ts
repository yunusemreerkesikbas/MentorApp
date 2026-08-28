import { describe, expect, it } from "vitest";
import { authShellShowsBack, authShellShowsHang, isAuthPath } from "./auth-paths";

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

describe("authShellShowsBack", () => {
  it("hides the header on login and signup", () => {
    expect(authShellShowsBack("/login")).toBe(false);
    expect(authShellShowsBack("/signup")).toBe(false);
  });

  it("shows a back control on nested auth screens", () => {
    expect(authShellShowsBack("/forgot-password")).toBe(true);
    expect(authShellShowsBack("/reset-password")).toBe(true);
    expect(authShellShowsBack("/verify-email")).toBe(true);
  });
});

describe("authShellShowsHang", () => {
  it("shows the hang mascot on login and signup", () => {
    expect(authShellShowsHang("/login")).toBe(true);
    expect(authShellShowsHang("/signup")).toBe(true);
    expect(authShellShowsHang("/forgot-password")).toBe(false);
  });
});
