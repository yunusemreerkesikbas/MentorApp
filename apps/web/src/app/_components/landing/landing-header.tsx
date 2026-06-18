import Link from "next/link";

/** Public landing top bar — minimal chrome, no app nav. */
export function LandingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
      <Link
        href="/"
        className="text-lg font-bold tracking-tight"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Mentor
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3" aria-label="Hesap">
        <Link
          href="/giris"
          className="flex min-h-11 items-center rounded-[var(--radius-card)] px-4 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Giriş
        </Link>
        <Link
          href="/kayit"
          className="flex min-h-11 items-center rounded-[var(--radius-card)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            backgroundColor: "var(--color-btn)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          Kayıt ol
        </Link>
      </nav>
    </header>
  );
}
