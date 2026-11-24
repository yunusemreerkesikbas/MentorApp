import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EXAM_TYPES } from "@mentor/types";
import { Logo } from "@mentor/ui";
import { PublicFooter } from "@/components/public-footer";
import { setRequestLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { fetchAppAvailability } from "@/lib/app-availability-server";
import { communityDiscoveryUrl, fetchDiscoveryQuestions } from "@/lib/forum-public";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, questions] = await Promise.all([
    getTranslations("communityDiscovery"),
    fetchDiscoveryQuestions().catch(() => []),
  ]);
  const title = t("meta_title");
  const description = t("description");
  const canonical = communityDiscoveryUrl();
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: locale === "tr" && questions.length > 0, follow: true },
    openGraph: { title, description, url: canonical, type: "website", siteName: "PuhuKoç" },
  };
}

export default async function CommunityDiscoveryPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, availability, questions] = await Promise.all([
    getTranslations("communityDiscovery"),
    fetchAppAvailability(),
    fetchDiscoveryQuestions().catch(() => null),
  ]);
  const groups = [...EXAM_TYPES, null]
    .map((examType) => ({ examType, questions: questions?.filter((q) => q.examType === examType) ?? [] }))
    .filter((group) => group.questions.length > 0);

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-main)]">
      <header className="border-b border-[var(--color-border)]">
        <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="inline-flex min-h-11 items-center text-xl"><Logo /></Link>
          <Link href="/knowledge" className="inline-flex min-h-11 items-center font-semibold underline">{t("blog")}</Link>
        </nav>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
        <div className="space-y-3">
          <h1 className="text-display font-black">{t("title")}</h1>
          <p className="text-body text-[var(--color-secondary)]">{t("description")}</p>
          {availability?.forum ? (
            <Link href="/community" className="inline-flex min-h-11 items-center font-extrabold underline">
              {t("join")}
            </Link>
          ) : null}
        </div>
        {groups.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            {t(questions === null || !availability ? "unavailable" : availability.forum ? "empty" : "preview")}
          </p>
        ) : groups.map((group) => (
          <section key={group.examType ?? "general"} className="space-y-2">
            <h2 className="text-section font-extrabold">{group.examType ?? t("general")}</h2>
            <ul className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4">
              {group.questions.map((q) => (
                <li key={q.id}>
                  <Link href={{ pathname: "/forum/question/[id]", params: { id: q.id } }} className="flex min-h-11 items-center py-2 font-semibold underline">
                    {q.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <PublicFooter wide />
    </div>
  );
}
