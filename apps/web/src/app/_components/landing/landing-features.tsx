import { Card, SectionHeading } from "@mentor/ui";

const FEATURES = [
  {
    title: "AI Koç",
    description:
      "Plan, motivasyon ve sınav kaygısı için yanında. Resmî tarihler editoryal içerikten — asla uydurma bilgi.",
    accent: "#D6DBFD",
  },
  {
    title: "Günlük ritüel",
    description:
      "Bugünün planı, odak seansı ve streak. Küçük adımlarla alışkanlık — yargılama yok.",
    accent: "#DDACE5",
  },
  {
    title: "Bilgi merkezi",
    description:
      "Küratörlü makaleler ve güvenilir takvim kaynakları. Okuma ücretsiz; koç yanıtları premium derinlikte.",
    accent: "#BDEBFF",
  },
] as const;

function FeatureIcon({ accent }: { accent: string }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-card)]"
      style={{ backgroundColor: accent }}
      aria-hidden
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-main)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l2 4 4 1-3 3 1 4-4-2-4 2 1-3-3 1-4-4z" />
      </svg>
    </span>
  );
}

/** Three product pillars — Nuton card stack on mobile, grid on desktop. */
export function LandingFeatures() {
  return (
    <section className="py-10 lg:py-14">
      <SectionHeading subtitle="Bilgi platformu değil — yoldaşlık platformu.">
        Üç katman, tek yol
      </SectionHeading>
      <ul className="mt-6 grid gap-4 lg:grid-cols-3 lg:gap-6">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <Card className="flex flex-col gap-3">
              <FeatureIcon accent={f.accent} />
              <h3
                className="text-base font-bold"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
                {f.description}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
