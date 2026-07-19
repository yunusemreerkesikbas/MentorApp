"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link, useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { getZone, isForumDisabled } from "@/lib/forum";
import { PendingMembers } from "./pending-members";
import { ReportQueue } from "./report-queue";

type State =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string }
  | { status: "ready"; zone: ZoneView };

export function ManageShell({ slug }: { slug: string }) {
  const t = useTranslations("community");
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getZone(slug)
      .then((zone) => {
        if (!active) return;
        if (!zone.canModerate) {
          setState({ status: "denied" });
          router.replace({
            pathname: "/community/[slug]",
            params: { slug },
          });
          return;
        }
        setState({ status: "ready", zone });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) return setState({ status: "denied" });
        setState({
          status: "error",
          message: err instanceof ApiClientError ? err.body.message : t("error"),
        });
      });
    return () => {
      active = false;
    };
  }, [slug, router, t]);

  if (state.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[40vh] w-full max-w-3xl items-center justify-center px-5 py-8">
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      </main>
    );
  }
  if (state.status === "denied") {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <p style={{ color: "var(--color-secondary)" }}>{t("not_authorized")}</p>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <FormError message={state.message} />
      </main>
    );
  }

  const { zone } = state;
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-10">
      <Link
        href={{ pathname: "/community/[slug]", params: { slug } }}
        className="text-sm"
        style={{ color: "var(--color-secondary)" }}
      >
        ← {zone.title}
      </Link>
      <h1
        className="mt-3 mb-6 text-2xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {t("manage_title")}
      </h1>
      <div className="flex flex-col gap-10">
        <PendingMembers zoneId={zone.id} />
        <ReportQueue zoneId={zone.id} />
      </div>
    </main>
  );
}
