import { setRequestLocale } from "next-intl/server";
import { LeaderboardScreen } from "./_components/leaderboard-screen";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LeaderboardScreen />;
}
