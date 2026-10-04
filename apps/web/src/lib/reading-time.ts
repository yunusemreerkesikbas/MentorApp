const WORDS_PER_MINUTE = 200;

/** Minutes to read an article body (Markdown or sanitized HTML). Display only; never below one. */
export function readingMinutes(body: string, format: "MARKDOWN" | "HTML"): number {
  const text =
    format === "HTML"
      ? body.replace(/<[^>]*>/g, " ")
      : body.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`~|]/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
