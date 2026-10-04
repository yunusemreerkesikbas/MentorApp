import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PublicChrome } from "@/components/public-chrome";
import { PublicFooter } from "@/components/public-footer";
import { PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { setRequestLocale } from "@/i18n/locale";
import { blogUrl, parseBlogQuery } from "@/lib/blog-url";
import { BlogHeader } from "./_components/blog-header";
import { ExamDaySkeleton, PostsSkeleton } from "./_components/blog-skeletons";
import { ExamDayCard } from "./_components/exam-day-card";
import { PostsSection } from "./_components/posts-section";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ locale }, raw] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("knowledge");
  const { family } = parseBlogQuery(raw);
  return {
    title: family === "KPSS" ? t("meta_title") : t("meta_title_family", { family }),
    description: t("meta_description"),
    alternates: { canonical: blogUrl(family) },
    robots: locale === "en" ? { index: false, follow: true } : undefined,
  };
}

/** Public blog hub. Header and filters paint at once; the list and the exam card stream on their own. */
export default async function BlogPage({ params, searchParams }: PageProps) {
  const [{ locale }, raw] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const query = parseBlogQuery(raw);
  const chrome = await getTranslations("article");

  return (
    <PublicChrome
      loginLabel={chrome("login")}
      panelLabel={chrome("panel")}
      blogLabel={chrome("blog")}
    >
      <main className={PANEL_MAIN_CLASS}>
        <div className={PANEL_GRID_CLASS}>
          <div className="flex min-w-0 flex-col gap-5">
            <BlogHeader query={query} />
            <Suspense
              key={`${query.family}-${query.category}-${query.page}`}
              fallback={<PostsSkeleton />}
            >
              <PostsSection query={query} locale={locale} />
            </Suspense>
          </div>
          <aside className="min-w-0 xl:sticky xl:top-6">
            <Suspense key={query.family} fallback={<ExamDaySkeleton />}>
              <ExamDayCard family={query.family} locale={locale} />
            </Suspense>
          </aside>
        </div>
      </main>
      <PublicFooter wide />
    </PublicChrome>
  );
}
