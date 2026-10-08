import { describe, expect, it } from "vitest";
import { ApiClientError } from "@mentor/api-client";
import { accountSecurityLoginHref, isReauthenticationRequired, loginSecurityReason } from "./account-security";

describe("account security sign-in", () => {
  it("recognizes only the server's reauthentication refusal", () => {
    const body = { code: "AUTH_REAUTHENTICATION_REQUIRED", message: "Sign in again", statusCode: 403 };
    expect(isReauthenticationRequired(new ApiClientError(403, body))).toBe(true);
    expect(isReauthenticationRequired(new ApiClientError(401, body))).toBe(false);
    expect(isReauthenticationRequired(new Error(body.message))).toBe(false);
  });

  it("accepts only known informational reasons and returns to the profile without a mutation", () => {
    expect(loginSecurityReason("?reason=reauth")).toBe("reauth");
    expect(loginSecurityReason("?reason=emailchanged")).toBe("emailchanged");
    expect(loginSecurityReason("?reason=<script>")).toBeNull();
    expect(accountSecurityLoginHref("reauth")).toEqual({ pathname: "/login", query: { next: "/profile", reason: "reauth" } });
  });
});
