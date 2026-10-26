"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { AuthUser, SubscriptionView } from "@mentor/types";
import {
  ApiClientError,
  subscriptionsControllerGetMine,
  usersControllerMe,
} from "@mentor/api-client";
import { Card, Skeleton, SkeletonGroup } from "@mentor/ui";
import { FormError } from "@/components/form";
import { PhoneVerificationCard } from "@/components/phone-verification-card";
import { useAuth } from "@/lib/auth-context";
import { isCoach } from "@/lib/coach-surface";
import { AccountLinksCard } from "./account-links-card";
import { ApplicationSupportCard } from "./application-support-card";
import { CoachScopeCard } from "./coach-scope-card";
import { EconomySection } from "./economy-section";
import { NotificationSettings } from "./notification-settings";
import { GoogleAccountCard } from "./google-account-card";
import { ProfileHeader } from "./profile-header";
import { SocialFollowCard } from "./social-follow-card";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { getProfileLinks } from "@/lib/profile-links";
import { SettingsLegalFooter } from "@/components/settings-legal-footer";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; premium: boolean; user: AuthUser };

/**
 * /settings orchestrator — account hub only; public identity lives under /community/member.
 */
export function ProfileShell({
  openProfileEditor = false,
}: {
  openProfileEditor?: boolean;
}) {
  const t = useTranslations("profile");
  const { user: authUser, setUserFromServer } = useAuth();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [economyRefreshKey, setEconomyRefreshKey] = useState(0);
  const [phoneHidden, setPhoneHidden] = useState(false);

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
        <section className="flex min-w-0 flex-col gap-5 lg:gap-6 [&>*:empty]:hidden">
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

          {/* The coach's half of the consent contract. Only for a coach: `dataScope` comes from a
              `@Roles(COACH)` endpoint, so for a student this row would open onto a 403. It sits
              first because it is the one setting that is about somebody else's data. */}
          {isCoach(user) && (
            <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
              <CoachScopeCard />
            </motion.div>
          )}

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <NotificationSettings />
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <GoogleAccountCard />
          </motion.div>

          {/* SMS off and no number on file: the card could only say "unavailable", so it goes.
              A verified number stays visible either way. */}
          {phoneHidden ? null : (
            // `phone-verification` is the anchor the invite card's "verify your phone" link targets.
            <motion.div id="phone-verification" variants={reduceMotion ? undefined : staggerItemVariants}>
              <PhoneVerificationCard
                allowNumberChange
                compactHeading
                onStatusChange={(phone) => setPhoneHidden(!phone.available && !phone.verified)}
              />
            </motion.div>
          )}

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <ApplicationSupportCard />
          </motion.div>
        </section>

        <aside className="flex min-w-0 flex-col gap-5 lg:gap-6 xl:sticky xl:top-8 xl:self-start [&>*:empty]:hidden">
          {hasSocialLinks ? (
            <motion.div
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              <SocialFollowCard />
            </motion.div>
          ) : null}

          {/* Not for a coach: every coin sink (Puhu chat, streak rescue, deep analysis) is a
              student surface, and the quests send them to /study-session and /dashboard, which
              bounce them home. The API still returns the full catalog; hiding here is enough. */}
          {!isCoach(user) && (
            <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
              <EconomySection refreshKey={economyRefreshKey} />
            </motion.div>
          )}

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <AccountLinksCard
              user={user}
              onSaved={(next) => {
                handleUserSaved(next);
                setEconomyRefreshKey((k) => k + 1);
              }}
            />
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <SettingsLegalFooter />
          </motion.div>
        </aside>
      </motion.div>
    ) : (
      <div className="min-h-[28rem]" aria-hidden />
    );

  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-5 py-6 lg:px-8 lg:py-10">
      <SkeletonGroup
        label={t("loading")}
        loading={loading}
        revealed={readyBody}
      >
        {/* minmax(0,1fr) on phones too: SkeletonGroup stacks this layer under the revealed one,
            so an auto column sized to the skeleton's min-content widened every card past 375px. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ProfileSkeletonBlocks coach={isCoach(authUser)} />
        </div>
      </SkeletonGroup>
    </main>
  );
}

/**
 * Mirrors the revealed layout: centred identity, list cards, side rail with the legal links. A coach
 * gets no Kazanımlar block, like the revealed rail; an unknown user still draws it.
 */
function ProfileSkeletonBlocks({ coach }: { coach: boolean }) {
  return (
    <>
      <section className="flex min-w-0 flex-col gap-5 lg:gap-6">
        <div className="flex flex-col items-center px-2 pb-1 pt-2">
          <Skeleton className="size-30 rounded-full" />
          <Skeleton className="mt-3 h-9 w-56 max-w-full rounded-[var(--radius-card)]" />
          <Skeleton className="mt-2 h-4 w-60 max-w-full rounded-[var(--radius-card)]" />
          <Skeleton className="mt-4 h-6 w-32 rounded-[var(--radius-card)]" />
        </div>
        <SkeletonListCard rows={3} trailing="toggle" />
        <SkeletonListCard rows={1} />
        <SkeletonListCard rows={5} />
      </section>
      <aside className="flex min-w-0 flex-col gap-5 lg:gap-6">
        {coach ? null : <SkeletonListCard rows={3} />}
        <SkeletonListCard rows={6} />
        <div className="flex flex-col gap-2 px-3">
          <Skeleton className="h-3 w-64 max-w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-3 w-56 max-w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-3 w-40 rounded-[var(--radius-card)]" />
        </div>
      </aside>
    </>
  );
}

/** One settings card: small section label, then 44px rows like `ListRow` / `ToggleRow`. */
function SkeletonListCard({
  rows,
  trailing = "chevron",
}: {
  rows: number;
  trailing?: "chevron" | "toggle";
}) {
  return (
    <Card solid className="p-2 sm:p-2.5">
      <div className="px-2 pt-1 pb-1.5">
        <Skeleton className="h-3 w-28 rounded-[var(--radius-card)]" />
      </div>
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
            <span className="min-w-0">
              <Skeleton
                className={`h-4 rounded-[var(--radius-card)] ${row % 2 ? "w-28" : "w-36"}`}
              />
              {/* ToggleRow shows its description from sm up. */}
              {trailing === "toggle" ? (
                <Skeleton className="mt-1.5 hidden h-3 w-56 max-w-full rounded-[var(--radius-card)] sm:block" />
              ) : null}
            </span>
            {trailing === "toggle" ? (
              <Skeleton className="h-7 w-12 shrink-0 rounded-full" />
            ) : (
              <Skeleton className="size-3 shrink-0 rounded-full" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
