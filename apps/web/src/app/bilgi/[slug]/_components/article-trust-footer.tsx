import { Card } from "@mentor/ui";

/** Editorial trust footer — guardrail §4 #1 (verified source, not LLM-generated). */
export function ArticleTrustFooter() {
  return (
    <footer className="mt-8">
      <Card className="!bg-white/50">
        <div className="flex flex-col gap-3">
          <span
            className="rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
              color: "var(--color-chip-text)",
              fontFamily: "var(--font-body)",
            }}
          >
            Doğrulanmış içerik
          </span>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
            Bu içerik editorial ekibimiz tarafından kaynak gösterilerek doğrulanmıştır. Resmî süreç
            ve tarihler ilgili kurum kaynaklarından alınır; değişiklik olursa güncellenir.
          </p>
        </div>
      </Card>
    </footer>
  );
}
