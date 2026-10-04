"use client";
import { Bell, Mail, Smartphone, Tag } from "lucide-react";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Card, Skeleton, SkeletonGroup, Toggle } from "@mentor/ui";
import type { NotificationPreferencesDto } from "@mentor/types";
import {
  ApiClientError,
  notificationsControllerGetPreferences,
  notificationsControllerUpdatePreferences,
} from "@mentor/api-client";
import { FormError } from "@/components/form";
import {
  browserPushSupport,
  hasBrowserPushSubscription,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
  type BrowserPushSupport,
} from "@/lib/web-push";

export function NotificationSettings() {
  const t = useTranslations("profile.notifications");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [campaignsEnabled, setCampaignsEnabled] = useState(true);
  const [pushSupport, setPushSupport] = useState<BrowserPushSupport>("ready");
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      notificationsControllerGetPreferences(),
      hasBrowserPushSubscription().catch(() => false),
    ])
      .then(([res, subscribed]) => {
        if (!active) return;
        const prefs = res as unknown as NotificationPreferencesDto;
        setEmailEnabled(prefs.emailEnabled);
        // The stored flag defaults to on for everyone; on here means this browser really receives.
        setPushEnabled(prefs.pushEnabled && subscribed);
        setCampaignsEnabled(prefs.campaignsEnabled);
        setPushSupport(browserPushSupport());
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiClientError ? err.message : t("load_error"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const savePreferences = async (
    patch: Partial<NotificationPreferencesDto>,
    rollback: Partial<NotificationPreferencesDto>,
  ): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const res = await notificationsControllerUpdatePreferences(patch);
      const prefs = res as unknown as NotificationPreferencesDto;
      setEmailEnabled(prefs.emailEnabled);
      setCampaignsEnabled(prefs.campaignsEnabled);
      // Push shows this browser, not only the stored flag, so only a push save may move it.
      if (patch.pushEnabled !== undefined) setPushEnabled(prefs.pushEnabled);
      return true;
    } catch (err) {
      if (rollback.emailEnabled !== undefined)
        setEmailEnabled(rollback.emailEnabled);
      if (rollback.pushEnabled !== undefined)
        setPushEnabled(rollback.pushEnabled);
      if (rollback.campaignsEnabled !== undefined)
        setCampaignsEnabled(rollback.campaignsEnabled);
      setError(err instanceof ApiClientError ? err.message : t("save_error"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async (next: boolean) => {
    setPushNotice(null);
    if (!next) {
      setPushEnabled(false);
      // Unsubscribe only once the server agrees, so a failed save leaves both sides as they were.
      if (await savePreferences({ pushEnabled: false }, { pushEnabled: true })) {
        await unsubscribeBrowserPush();
      }
      return;
    }
    setSaving(true);
    const result = await subscribeBrowserPush();
    setSaving(false);
    if (result !== "subscribed") {
      setPushNotice(t(result === "denied" ? "push_denied" : "push_subscribe_error"));
      return;
    }
    setPushEnabled(true);
    await savePreferences({ pushEnabled: true }, { pushEnabled: false });
  };

  const pushHint =
    pushSupport === "unsupported"
      ? t("push_not_supported")
      : pushSupport === "unconfigured"
        ? t("push_not_configured")
        : pushNotice;

  const settingsBody = (
    <Card id="notification-settings" solid className="p-2 sm:p-2.5">
      <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
        <h2
          className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("title")}
        </h2>
        <Bell size={16} className="text-[var(--color-secondary)]" aria-hidden />
      </div>
      {error ? <FormError message={error} /> : null}
      <div className="flex flex-col gap-0.5">
        <ToggleRow
          checked={emailEnabled}
          description={t("email_desc")}
          disabled={saving || loading}
          icon={<Mail size={18} aria-hidden />}
          label={t("email")}
          onChange={(next) => {
            const prev = emailEnabled;
            setEmailEnabled(next);
            void savePreferences(
              { emailEnabled: next },
              { emailEnabled: prev },
            );
          }}
        />
        <ToggleRow
          checked={pushEnabled}
          description={t("push_desc")}
          disabled={saving || loading || pushSupport !== "ready"}
          icon={<Smartphone size={18} aria-hidden />}
          label={t("push")}
          onChange={(next) => void togglePush(next)}
        />
        {/* Always mounted so a screen reader hears the hint when it appears; the row description
            above is hidden on phones, which is where a denied permission most often happens. */}
        <p
          role="status"
          className={
            pushHint
              ? "px-3 pb-1.5 text-xs leading-4 text-[var(--color-secondary)]"
              : "sr-only"
          }
          style={{ fontFamily: "var(--font-body)" }}
        >
          {pushHint}
        </p>
        {/*
          Commercial messages, unlike the two reminder channels above. Off silences every channel
          for them — the inbox included — because "in-app is always written" is a rule for
          transactional reminders, not for a campaign.
        */}
        <ToggleRow
          checked={campaignsEnabled}
          description={t("campaigns_desc")}
          disabled={saving || loading}
          icon={<Tag size={18} aria-hidden />}
          label={t("campaigns")}
          onChange={(next) => {
            const prev = campaignsEnabled;
            setCampaignsEnabled(next);
            void savePreferences(
              { campaignsEnabled: next },
              { campaignsEnabled: prev },
            );
          }}
        />
      </div>
    </Card>
  );

  return (
    <SkeletonGroup label={t("title")} loading={loading} revealed={settingsBody}>
      <Card solid className="p-2 sm:p-2.5">
        <Skeleton className="h-4 w-36 rounded-[var(--radius-card)]" />
        <Skeleton className="mt-2.5 h-10 rounded-[var(--radius-card)]" />
        <Skeleton className="mt-1 h-10 rounded-[var(--radius-card)]" />
        <Skeleton className="mt-1 h-10 rounded-[var(--radius-card)]" />
      </Card>
    </SkeletonGroup>
  );
}

function ToggleRow({
  checked,
  description,
  disabled,
  icon,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-[calc(var(--radius-card)-2px)] px-3 py-1.5 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)]">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center text-[var(--color-secondary)]">
          {icon}
        </span>
        <span className="min-w-0">
          <span
            className="block truncate text-sm font-medium leading-5 text-[var(--color-main)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {label}
          </span>
          <span className="mt-0.5 hidden text-xs leading-4 text-[var(--color-secondary)] sm:block">
            {description}
          </span>
        </span>
      </span>
      <Toggle
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
      />
    </div>
  );
}
