"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AuthUser } from "@mentor/types";
import { ApiClientError, usersControllerMe } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { FormError } from "../../../../components/form";
import { useAuth } from "../../../../lib/auth-context";
import { AccountLinksCard } from "./account-links-card";
import { ExamSettingsCard } from "./exam-settings-card";
import { NotificationSettings } from "./notification-settings";
import { ProfileHeader } from "./profile-header";
import { staggerItemVariants, staggerListVariants } from "../../../../lib/stagger-motion";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; user: AuthUser };

/**
 * /profil orchestrator — loads fresh user snapshot, syncs auth context, staggered section entrance.
 */
export function ProfilShell() {
  const { setUserFromServer } = useAuth();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    usersControllerMe()
      .then((res) => {
        if (!active) return;
        const user = res as unknown as AuthUser;
        setUserFromServer(user);
        setState({ status: "ready", user });
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
                : "Bir hata oluştu.",
        });
      });
    return () => {
      active = false;
    };
  }, [setUserFromServer]);

  if (state.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-5 py-8 lg:px-8">
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
        <FormError message={state.message} />
      </main>
    );
  }

  const { user } = state;
  const motionProps = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold lg:text-3xl"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Profil
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Hesap ve bildirim tercihlerin.
        </p>
      </header>

      <motion.div className="flex flex-col gap-6" {...motionProps}>
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <Card>
            <ProfileHeader user={user} />
          </Card>
        </motion.div>

        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <ExamSettingsCard user={user} />
        </motion.div>

        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <AccountLinksCard />
        </motion.div>

        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <NotificationSettings />
        </motion.div>
      </motion.div>
    </main>
  );
}
