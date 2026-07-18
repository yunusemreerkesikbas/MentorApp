import { describe, expect, it } from "vitest";

describe("article body", () => {
  it("keeps editorial structure and removes executable HTML", async () => {
    const { sanitizeArticleHtml } = await import("./article-body");
    const html = sanitizeArticleHtml(
      '<h2 onclick="alert(1)">Başlık</h2><script>alert(1)</script><p style="color:red">Metin</p><a href="javascript:alert(1)">kötü</a><a href="https://osym.gov.tr">ÖSYM</a>',
      "https://cdn.mentor.test/content/articles/body/",
    );

    expect(html).toContain("<h2>Başlık</h2>");
    expect(html).toContain("<p>Metin</p>");
    expect(html).not.toMatch(/script|onclick|style=|javascript:/);
    expect(html).toContain(
      '<a href="https://osym.gov.tr" target="_blank" rel="noopener noreferrer">ÖSYM</a>',
    );
  });

  it("accepts only storage-owned body images with alt text", async () => {
    const { ArticleBodyError, sanitizeArticleHtml } = await import("./article-body");
    const storageBaseUrl = "https://cdn.mentor.test/content/articles/body/";

    expect(() =>
      sanitizeArticleHtml(
        '<p><img src="https://tracker.test/pixel.png" alt="Takip"></p>',
        storageBaseUrl,
      ),
    ).toThrow(ArticleBodyError);
    expect(() =>
      sanitizeArticleHtml(
        `<p><img src="${storageBaseUrl}image.webp"></p>`,
        storageBaseUrl,
      ),
    ).toThrow(ArticleBodyError);
    expect(
      sanitizeArticleHtml(
        `<p><img src="${storageBaseUrl}image.webp" alt="Başvuru ekranı" width="1200" height="630"></p>`,
        storageBaseUrl,
      ),
    ).toContain('alt="Başvuru ekranı"');
  });

  it("converts legacy Markdown to editor HTML", async () => {
    const { markdownToEditorHtml } = await import("./article-body");
    const html = await markdownToEditorHtml(
      "## Başvuru özeti\n\n- İlk adım\n- İkinci adım",
      "https://cdn.mentor.test/content/articles/body/",
    );

    expect(html).toContain("<h2>Başvuru özeti</h2>");
    expect(html).toContain("<li>İlk adım</li>");
  });

  it("produces tag-free embedding text for both formats", async () => {
    const { articleBodyToPlainText } = await import("./article-body");
    await expect(
      articleBodyToPlainText(
        "<h2>Başvuru</h2><p>ÖSYM rehberi</p>",
        "HTML",
        "https://cdn.mentor.test/content/articles/body/",
      ),
    ).resolves.toBe("Başvuru ÖSYM rehberi");
    await expect(
      articleBodyToPlainText(
        "## Başvuru\n\n**ÖSYM** rehberi",
        "MARKDOWN",
        "https://cdn.mentor.test/content/articles/body/",
      ),
    ).resolves.toBe("Başvuru ÖSYM rehberi");
  });
});
