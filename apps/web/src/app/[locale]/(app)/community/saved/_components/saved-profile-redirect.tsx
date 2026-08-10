"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

export function SavedProfileRedirect() {
  const t = useTranslations("community");
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.username) return;
    router.replace({
      pathname: "/community/member/[username]",
      params: { username: user.username },
      query: { tab: "bookmarks" },
    });
  }, [router, user?.username]);

  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8">
      <p className="text-sm text-[var(--color-secondary)]">{t("loading")}</p>
    </main>
  );
}
