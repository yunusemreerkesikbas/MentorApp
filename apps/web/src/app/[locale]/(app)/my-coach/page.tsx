import { Suspense } from "react";
import { setRequestLocale } from "@/i18n/locale";
import { MyCoachShell } from "./_components/my-coach-shell";

export default async function MyCoachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // useSearchParams (the arrival greeting) needs a Suspense boundary or the route opts out of static rendering.
  return (
    <Suspense>
      <MyCoachShell />
    </Suspense>
  );
}
