"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { isForumDisabled, listZones } from "@/lib/forum";
import { ZoneCard } from "./zone-card";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; zones: ZoneView[] };

/** Zone types in display order; each becomes a labelled group. */
const GROUPS = [
  { type: "ANNOUNCEMENT", key: "group_announcement" },
  { type: "CHAT", key: "group_chat" },
  { type: "QA", key: "group_qa" },
] as const;

export function ToplulukShell() {
  const t = useTranslations("topluluk");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    listZones()
      .then((res) => {
        if (active) setState({ status: "ready", zones: res.items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) {
          setState({ status: "disabled" });
          return;
        }
        setState({
          status: "error",
          message: err instanceof ApiClientError ? err.body.message : t("error"),
        });
      });
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold lg:text-3xl"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("title")}
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          {t("subtitle")}
        </p>
      </header>

      {state.status === "loading" ? (
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      ) : state.status === "disabled" ? (
        <EmptyState title={t("soon_title")} desc={t("soon_desc")} />
      ) : state.status === "error" ? (
        <FormError message={state.message} />
      ) : state.zones.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="flex flex-col gap-8">
          {GROUPS.map(({ type, key }) => {
            const zones = state.zones.filter((z) => z.type === type);
            if (zones.length === 0) return null;
            return (
              <section key={type} className="flex flex-col gap-4">
                <SectionHeading>{t(key)}</SectionHeading>
                <div className="flex flex-col gap-4">
                  {zones.map((z) => (
                    <ZoneCard key={z.id} zone={z} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-white bg-white/50 px-6 py-12 text-center">
      <p className="text-lg font-semibold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>
        {title}
      </p>
      {desc ? (
        <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {desc}
        </p>
      ) : null}
    </div>
  );
}
