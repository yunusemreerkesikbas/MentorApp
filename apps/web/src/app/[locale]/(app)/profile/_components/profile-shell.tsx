"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { AuthUser, SubscriptionView } from "@mentor/types";
import { ApiClientError, subscriptionsControllerGetMine, usersControllerMe } from "@mentor/api-client";
import { Card, Skeleton, SkeletonGroup } from "@mentor/ui";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { AccountLinksCard } from "./account-links-card";
import { ApplicationSupportCard } from "./application-support-card";
import { EconomySection } from "./economy-section";
import { NotificationSettings } from "./notification-settings";
import { ProfileHeader } from "./profile-header";
import { SocialFollowCard } from "./social-follow-card";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { getProfileLinks } from "@/lib/profile-links";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; premium: boolean; user: AuthUser };

/**
 * /settings orchestrator — account hub only; public identity lives under /community/member.
 */
export function ProfileShell({ openProfileEditor = false }: { openProfileEditor?: boolean }) {
  const t = useTranslations("profile");
  const { setUserFromServer } = useAuth();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [economyRefreshKey, setEconomyRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      usersControllerMe(),
      subscriptionsControllerGetMine().catch(() => null),
    ])
      .then(([userRes, subscription]) => {
        if (!active) return;
        const user = userRes as unknown as AuthUser;
        setUserFromServer(user);
        const view = subscription as unknown as SubscriptionView | null;
        setState({
          status: "ready",
          premium: Boolean(view?.entitlement?.isPremium),
          user,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.body.message
              : err instanceof Error
                ? err.message
                : String(err),
        });
      });
    return () => {
      active = false;
    };
  }, [setUserFromServer]);

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
        <FormError message={state.message} />
      </main>
    );
  }

  const loading = state.status === "loading";
  const premium = state.status === "ready" ? state.premium : false;
  const user = state.status === "ready" ? state.user : null;
  const hasSocialLinks = getProfileLinks().social.length > 0;
  const handleUserSaved = (next: AuthUser) => {
    setUserFromServer(next);
    setState({ status: "ready", premium, user: next });
  };
  const motionProps = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  const readyBody =
    user != null ? (
      <motion.div
        className="grid min-w-0 gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
        {...motionProps}
      >
        <section className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <ProfileHeader
              autoOpenEdit={openProfileEditor}
              premium={premium}
              user={user}
              onSaved={(next) => {
                handleUserSaved(next);
                setEconomyRefreshKey((k) => k + 1);
              }}
            />
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <NotificationSettings />
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <ApplicationSupportCard />
          </motion.div>
        </section>

        <aside className="flex min-w-0 flex-col gap-5 lg:gap-6 xl:sticky xl:top-8 xl:self-start">
          {hasSocialLinks ? (
            <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
              <SocialFollowCard />
            </motion.div>
          ) : null}

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <EconomySection refreshKey={economyRefreshKey} />
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <AccountLinksCard
              user={user}
              onSaved={(next) => {
                handleUserSaved(next);
                setEconomyRefreshKey((k) => k + 1);
              }}
            />
          </motion.div>
        </aside>
      </motion.div>
    ) : (
      <div className="min-h-[28rem]" aria-hidden />
    );

  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-5 py-6 lg:px-8 lg:py-10">
      <SkeletonGroup label={t("loading")} loading={loading} revealed={readyBody}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ProfileSkeletonBlocks />
        </div>
      </SkeletonGroup>
    </main>
  );
}

function ProfileSkeletonBlocks() {
  return (
    <>
      <section className="flex flex-col gap-6">
        <Card solid className="overflow-hidden p-0">
          <Skeleton className="h-28 rounded-none" />
          <div className="p-6">
            <Skeleton className="-mt-14 h-24 w-24 rounded-[var(--radius-card)]" />
            <Skeleton className="mt-5 h-7 w-60 max-w-full rounded-[var(--radius-card)]" />
            <Skeleton className="mt-3 h-4 w-72 max-w-full rounded-[var(--radius-card)]" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-14 rounded-[var(--radius-card)]" />
              <Skeleton className="h-14 rounded-[var(--radius-card)]" />
            </div>
          </div>
        </Card>
        <Card>
          <Skeleton className="h-6 w-48 rounded-[var(--radius-card)]" />
          <div className="mt-4 grid gap-2">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-12 rounded-[var(--radius-card)]" />
            ))}
          </div>
        </Card>
      </section>
      <aside className="flex flex-col gap-6">
        <Card>
          <Skeleton className="h-6 w-44 rounded-[var(--radius-card)]" />
          <Skeleton className="mt-4 h-12 rounded-[var(--radius-card)]" />
          <Skeleton className="mt-3 h-12 rounded-[var(--radius-card)]" />
        </Card>
        <Card>
          <Skeleton className="h-6 w-24 rounded-[var(--radius-card)]" />
          <Skeleton className="mt-4 h-12 rounded-[var(--radius-card)]" />
          <Skeleton className="mt-3 h-12 rounded-[var(--radius-card)]" />
        </Card>
        <Card>
          <Skeleton className="h-6 w-32 rounded-[var(--radius-card)]" />
          <Skeleton className="mt-4 h-12 rounded-[var(--radius-card)]" />
          <Skeleton className="mt-3 h-12 rounded-[var(--radius-card)]" />
        </Card>
      </aside>
    </>
  );
}
