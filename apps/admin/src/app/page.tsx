export default function AdminHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-5 py-16">
      <h1
        className="text-3xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Mentor Admin
      </h1>
      <p style={{ color: "var(--color-secondary)" }}>
        İç yönetim paneli kabuğu. Erişim yalnız ekip (Cloudflare Access + davetle hesap,
        self-signup yok — §9). Modüller: içerik editörü · kullanıcı yönetimi · refund ·
        metrik · feature flags · audit log.
      </p>
    </main>
  );
}
