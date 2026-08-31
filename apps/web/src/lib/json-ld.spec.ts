import { describe, expect, it } from "vitest";
import { jsonLdHtml } from "./json-ld";

describe("jsonLdHtml", () => {
  it("escapes user-controlled closing tags before inline JSON-LD rendering", () => {
    const html = jsonLdHtml({
      text: '</script><script>window.__injected = true</script>',
    });

    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script>");
    expect(JSON.parse(html)).toEqual({
      text: '</script><script>window.__injected = true</script>',
    });
  });
});
