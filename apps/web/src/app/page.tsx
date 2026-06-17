import type { Metadata } from "next";
import { LandingPage } from "./_components/landing/landing-page";
import { fetchInfoArticlesByFamily } from "../lib/content-api";

export const metadata: Metadata = {
  title: "Mentor — Sınav Yoldaşın",
  description:
    "Sınav hazırlığında seni anlayan, devam ettiren ve yalnız bırakmayan AI koç. Günlük ritüel, plan ve bilgi merkezi.",
  openGraph: {
    title: "Mentor — Sınav Yoldaşın",
    description:
      "Sınav yolunda yalnız değilsin. AI koç, günlük ritüel ve güvenilir bilgi merkezi.",
    locale: "tr_TR",
    type: "website",
  },
};

/** KPSS seed articles for public editorial links on landing (exam-agnostic product, KPSS first seed). */
async function landingEditorialArticles() {
  try {
    const res = await fetchInfoArticlesByFamily("KPSS", 1, 3);
    return res.items;
  } catch {
    return [];
  }
}

export default async function Home() {
  const articles = await landingEditorialArticles();
  return <LandingPage articles={articles} />;
}
