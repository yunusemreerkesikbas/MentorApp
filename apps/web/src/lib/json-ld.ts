/**
 * Serialize JSON-LD for an inline `<script type="application/ld+json">`. Escapes `<` so any
 * user-generated string (forum titles/bodies) can't emit a literal `</script>` and break out of
 * the tag → stored XSS. Always use this instead of bare `JSON.stringify` for inline JSON-LD.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
