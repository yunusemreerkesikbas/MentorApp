import { NotificationSettings } from "./_components/notification-settings";

export default function ProfilPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold lg:text-3xl"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Profil
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Hesap ve bildirim tercihlerin.
        </p>
      </header>
      <NotificationSettings />
    </main>
  );
}
