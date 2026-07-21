"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { isForumDisabled, listZones } from "@/lib/forum";
import { ZoneShellSkeleton } from "../[slug]/_components/zone-shell-skeleton";

/**
 * /community landing — no zone list page anymore. Resolve the general chat room (first CHAT zone,
 * else the first zone) and replace into its feed so the user lands straight in the thread view.
 */
export function GeneralFeed() {
  const t = useTranslations("community");
  const router = useRouter();
  const [state, setState] = useState<"loading" | "disabled" | "empty" | "error">("loading");

  useEffect(() => {
    let active = true;
    listZones()
      .then((res) => {
        if (!active) return;
        const zones = res.items;
        if (zones.length === 0) return setState("empty");
        const general = zones.find((z) => z.type === "CHAT") ?? zones[0]!;
        router.replace({
          pathname: "/community/[slug]",
          params: { slug: general.slug },
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState(isForumDisabled(err) ? "disabled" : "error");
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-2xl">
        <ZoneShellSkeleton label={t("loading")} />
      </div>
    );
  }

  const message =
    state === "disabled" ? t("soon_title") : state === "empty" ? t("empty") : t("error");
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{message}</p>
    </main>
  );
}
