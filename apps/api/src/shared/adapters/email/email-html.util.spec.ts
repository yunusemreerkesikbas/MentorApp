import { describe, expect, it } from "vitest";
import { assertSafeHttpUrl, escapeHtml } from "./email-html.util";

describe("email-html.util", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("accepts http(s) URLs only", () => {
    expect(assertSafeHttpUrl("https://mentor.app/verify?token=abc")).toContain("https://");
    expect(assertSafeHttpUrl("javascript:alert(1)")).toBe("");
    expect(assertSafeHttpUrl("not-a-url")).toBe("");
  });
});
