import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateReadingMinutes,
  extractInternalArticleSlug,
  parseMarkdownBlocks,
  resolveContentMediaUrl,
  resolveExamFamilyParam,
  showsFeaturedArticle,
  splitArticleProvenance,
} from "./knowledge-view.ts";

describe("knowledge-view helpers", () => {
  it("resolves exam family defaults and featured article visibility", () => {
    assert.equal(resolveExamFamilyParam("ales", "YKS"), "ALES");
    assert.equal(resolveExamFamilyParam("unknown", "DGS"), "DGS");
    assert.equal(resolveExamFamilyParam(undefined, null), "KPSS");

    assert.equal(showsFeaturedArticle({ category: "GENERAL" }, null, 1), true);
    assert.equal(showsFeaturedArticle({ category: "GENERAL" }, "GENERAL", 1), true);
    assert.equal(showsFeaturedArticle({ category: "GENERAL" }, "APPLICATION", 1), false);
    assert.equal(showsFeaturedArticle({ category: "GENERAL" }, null, 2), false);
  });

  it("extracts internal guide slugs and resolves media urls", () => {
    assert.equal(
      extractInternalArticleSlug("/blog/kpss-lisans-alan-bilgisi-oturumlari"),
      "kpss-lisans-alan-bilgisi-oturumlari",
    );
    assert.equal(
      extractInternalArticleSlug("http://localhost:3000/blog/yks-basvurusu-nasil-yapilir"),
      "yks-basvurusu-nasil-yapilir",
    );
    assert.equal(
      extractInternalArticleSlug("https://dokuman.osym.gov.tr/pdf/test.pdf"),
      null,
    );
    assert.equal(
      resolveContentMediaUrl("/v1/media/cover.webp", "http://10.0.2.2:3001/"),
      "http://10.0.2.2:3001/v1/media/cover.webp",
    );
  });

  it("splits provenance scope/citation and estimates reading minutes", () => {
    const md = [
      "Giriş metni.",
      "",
      "> **Kaynak kapsamı:** ÖSYM 2026 kılavuzu.",
      "",
      "## Başlık",
      "",
      "Paragraf metni.",
      "",
      "## Kaynaklar",
      "",
      "- [ÖSYM](https://osym.gov.tr)",
      "",
      "## İlgili yazılar",
      "",
      "- [Diğer](/blog/diger)",
    ].join("\n");

    const split = splitArticleProvenance(md, "MARKDOWN");
    assert.equal(split.scope, "ÖSYM 2026 kılavuzu.");
    assert.equal(split.citation, "- [ÖSYM](https://osym.gov.tr)");
    assert.equal(split.body.includes("Kaynaklar"), false);
    assert.equal(split.body.includes("## İlgili yazılar"), true);
    assert.equal(estimateReadingMinutes("word ".repeat(250), "MARKDOWN"), 2);
  });

  it("parses headings, quotes, tables, lists, and inline links/bold cleanly", () => {
    const md = [
      "> Not **önemli**.",
      "",
      "## Puan türü",
      "",
      "| Puan | Sayısal |",
      "| --- | ---: |",
      "| EA | %50 |",
      "",
      "- [ÖSYM Kılavuz](https://osym.gov.tr) bağlantısı",
    ].join("\n");

    const blocks = parseMarkdownBlocks(md, "MARKDOWN");
    assert.equal(blocks[0]?.kind, "blockquote");
    assert.equal(blocks[1]?.kind, "heading");
    assert.equal(blocks[2]?.kind, "table");
    if (blocks[2]?.kind === "table") {
      assert.deepEqual(blocks[2].alignments, ["left", "right"]);
      assert.equal(blocks[2].rows[0]?.[1]?.[0]?.text, "%50");
    }
    assert.equal(blocks[3]?.kind, "list");
    if (blocks[3]?.kind === "list") {
      assert.equal(blocks[3].items[0]?.[0]?.href, "https://osym.gov.tr");
    }
  });
});
