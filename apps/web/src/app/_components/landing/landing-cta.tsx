import Link from "next/link";
import { Card } from "@mentor/ui";

/** Final CTA band before footer. */
export function LandingCtaBand() {
  return (
    <section className="py-10 lg:py-14">
      <Card className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p
            className="text-xl font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            Bugün küçük bir adım yeter.
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
            Ücretsiz başla; premium ile koç derinliğini dene.
          </p>
        </div>
        <Link
          href="/kayit"
          className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none lg:w-auto"
          style={{
            backgroundColor: "var(--color-btn)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          Ücretsiz kayıt
        </Link>
      </Card>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer
      className="border-t border-white py-8 text-center text-xs"
      style={{ color: "var(--color-secondary)" }}
    >
      <p>Resmî sınav bilgileri editoryal içerikten gelir — koç asla tarih uydurmaz.</p>
      <p className="mt-2">© {new Date().getFullYear()} Mentor</p>
    </footer>
  );
}

export function LandingFooterSection() {
  return <LandingFooter />;
}
