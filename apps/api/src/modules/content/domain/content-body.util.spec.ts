import { describe, expect, it } from "vitest";
import { ContentBodyError, markdownToEditorHtml, sanitizeEditorHtml, toRagPlainText } from "./content-body.util";

const storagePublicBaseUrl = "https://storage.example.com";

describe("content body utilities", () => {
  it("keeps the HTML allowlist and strips executable content", () => {
    const html = sanitizeEditorHtml('<h2>Başlık</h2><p onclick="alert(1)">Metin <strong>kalın</strong></p><script>alert(1)</script><iframe src="https://evil.example"></iframe>', { storagePublicBaseUrl });
    expect(html).toBe("<h2>Başlık</h2><p>Metin <strong>kalın</strong></p>");
  });

  it("keeps safe links and hardens external links", () => {
    const html = sanitizeEditorHtml('<a href="/bilgi">İç</a><a href="https://example.com">Dış</a><a href="javascript:alert(1)">Kötü</a>', { storagePublicBaseUrl });
    expect(html).toContain('<a href="/bilgi">İç</a>');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Dış</a>');
    expect(html).not.toContain("javascript:");
  });

  it("accepts only content article body images with alt text", () => {
    const html = sanitizeEditorHtml('<img src="https://storage.example.com/content/articles/body/guide.png" alt="Çalışma programı">', { storagePublicBaseUrl });
    expect(html).toBe('<img src="https://storage.example.com/content/articles/body/guide.png" alt="Çalışma programı" />');
  });

  it("rejects an image outside the configured body storage prefix", () => {
    expect(() => sanitizeEditorHtml('<img src="https://evil.example/image.png" alt="x">', { storagePublicBaseUrl })).toThrow(ContentBodyError);
  });

  it("renders Markdown as sanitized editor HTML", () => {
    const html = markdownToEditorHtml("## Plan\n\n[Kaynak](https://example.com)\n\n<script>alert(1)</script>", { storagePublicBaseUrl });
    expect(html).toContain("<h2>Plan</h2>");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("script");
  });

  it("converts sanitized HTML and Markdown into RAG plain text", () => {
    expect(toRagPlainText('<h2>Plan</h2><p>Her gün <strong>çalış.</strong></p>', { storagePublicBaseUrl })).toBe("Plan Her gün çalış.");
    expect(toRagPlainText("## Plan\n\nHer gün **çalış.**", { storagePublicBaseUrl, input: "markdown" })).toBe("Plan Her gün çalış.");
  });

  it("rejects a body left empty after sanitization", () => {
    expect(() => sanitizeEditorHtml("<script>alert(1)</script>", { storagePublicBaseUrl })).toThrow(ContentBodyError);
  });
});
