/** Move explicitly labelled editorial provenance into one visible source section. */
export function splitArticleProvenance(body: string, format: "MARKDOWN" | "HTML") {
  if (format !== "MARKDOWN") return { body, scope: null, citation: null };
  let scope: string | null = null;
  let citation: string | null = null;
  const content = body
    .replace(/^> (?:\*\*)?Kaynak kapsamı:(?:\*\*)?([^\n]*(?:\n>[^\n]*)*)/m, (_, text: string) => {
      scope = text.replace(/\n>\s?/g, "\n").trim();
      return "";
    })
    .replace(/^## Kaynak(?:lar)?[ \t]*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m, (_, text: string) => {
      citation = text.trim();
      return "";
    });
  return { body: content.trim(), scope, citation };
}
