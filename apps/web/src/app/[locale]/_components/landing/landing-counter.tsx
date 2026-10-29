import { getTranslations } from "next-intl/server";
import { fetchStudiedLast24h } from "@/lib/public-pulse";

/**
 * "Son 24 saatte {n} kişi burada çalıştı." Streams in under the hero (rendered inside Suspense), so
 * the headline never waits for it; below the threshold, or without the API, there is no line at all.
 */
export async function LandingCounter() {
  const [count, t] = await Promise.all([fetchStudiedLast24h(), getTranslations("landing")]);
  if (count === null) return null;
  return (
    <p className="lc-pulse">
      <i aria-hidden="true" />
      {t("counter", { count })}
    </p>
  );
}
