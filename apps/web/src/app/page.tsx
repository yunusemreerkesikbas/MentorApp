import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-5 py-16">
      <span
        className="w-fit rounded-[var(--radius-card)] px-4 py-2 text-sm font-semibold"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
        }}
      >
        Mentor · iskelet
      </span>

      <h1
        className="text-4xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Sınav yolunda yalnız değilsin.
      </h1>

      <p className="text-lg leading-relaxed" style={{ color: "var(--color-secondary)" }}>
        Seni anlayan, devam ettiren ve yalnız bırakmayan bir AI koç + topluluk.
        Bu, projenin çalışan web kabuğu — özellikler roadmap&apos;e göre eklenecek.
      </p>

      <Link
        href="/kayit"
        className="w-fit rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white"
        style={{ backgroundColor: "var(--color-btn)", boxShadow: "var(--shadow-card)" }}
      >
        Hadi başlayalım
      </Link>
    </main>
  );
}
