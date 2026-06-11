/** Editorial trust footer — guardrail §4 #1 (verified source, not LLM-generated). */
export function ArticleTrustFooter() {
  return (
    <footer
      className="mt-8 border-t pt-6 text-sm leading-relaxed"
      style={{
        borderColor: "color-mix(in srgb, var(--color-secondary) 20%, transparent)",
        color: "var(--color-secondary)",
      }}
    >
      <p>
        Bu içerik editorial ekibimiz tarafından kaynak gösterilerek doğrulanmıştır. Resmî süreç
        ve tarihler ilgili kurum kaynaklarından alınır; değişiklik olursa güncellenir.
      </p>
    </footer>
  );
}
