"use client";
import { Bell, Mail, Smartphone, Tag } from "lucide-react";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Card, SectionHeading, Skeleton } from "@mentor/ui";
import type { NotificationPreferencesDto } from "@mentor/types";
import {
  ApiClientError,
  notificationsControllerGetPreferences,
  notificationsControllerUpdatePreferences,
} from "@mentor/api-client";
import { FormError } from "@/components/form";

export function NotificationSettings() {
  const t = useTranslations("profile.notifications");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [campaignsEnabled, setCampaignsEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    notificationsControllerGetPreferences()
      .then((res) => {
        if (!active) return;
        const prefs = res as unknown as NotificationPreferencesDto;
        setEmailEnabled(prefs.emailEnabled);
        setPushEnabled(prefs.pushEnabled);
        setCampaignsEnabled(prefs.campaignsEnabled);
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
  ) => {
    setSaving(true);
    setError(null);
    try {
      const res = await notificationsControllerUpdatePreferences(patch);
      const prefs = res as unknown as NotificationPreferencesDto;
      setEmailEnabled(prefs.emailEnabled);
      setPushEnabled(prefs.pushEnabled);
      setCampaignsEnabled(prefs.campaignsEnabled);
    } catch (err) {
      if (rollback.emailEnabled !== undefined)
        setEmailEnabled(rollback.emailEnabled);
      if (rollback.pushEnabled !== undefined)
        setPushEnabled(rollback.pushEnabled);
      if (rollback.campaignsEnabled !== undefined)
        setCampaignsEnabled(rollback.campaignsEnabled);
      setError(err instanceof ApiClientError ? err.message : t("save_error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card solid className="p-4">
        <Skeleton className="h-6 w-44 rounded-[var(--radius-card)]" />
        <Skeleton className="mt-4 h-14 rounded-[var(--radius-card)]" />
        <Skeleton className="mt-3 h-14 rounded-[var(--radius-card)]" />
      </Card>
    );
  }

  return (
    <Card id="notification-settings" solid className="p-4">
      <SectionHeading
        action={
          <span className="grid size-10 place-items-center rounded-[var(--radius-card)] text-[var(--color-main)]">
            <Bell size={20} aria-hidden />
          </span>
        }
      >
        {t("title")}
      </SectionHeading>
      {error ? <FormError message={error} /> : null}
      <div className="mt-3 divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-card)]">
        <ToggleRow
          checked={emailEnabled}
          description={t("email_desc")}
          disabled={saving}
          icon={<Mail size={20} aria-hidden />}
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
          disabled={saving}
          icon={<Smartphone size={20} aria-hidden />}
          label={t("push")}
          onChange={(next) => {
            const prev = pushEnabled;
            setPushEnabled(next);
            void savePreferences({ pushEnabled: next }, { pushEnabled: prev });
          }}
        />
        {/*
          Commercial messages, unlike the two reminder channels above. Off silences every channel
          for them — the inbox included — because "in-app is always written" is a rule for
          transactional reminders, not for a campaign.
        */}
        <ToggleRow
          checked={campaignsEnabled}
          description={t("campaigns_desc")}
          disabled={saving}
          icon={<Tag size={20} aria-hidden />}
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
    <label className="flex min-h-16 min-w-0 cursor-pointer items-center justify-between gap-3 bg-[var(--color-surface)] px-3 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_3%,transparent)] focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)] focus-within:ring-offset-2">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] text-[var(--color-main)]">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-bold text-[var(--color-main)]">
            {label}
          </span>
          <span className="mt-0.5 hidden text-sm leading-5 text-[var(--color-secondary)] sm:block">
            {description}
          </span>
        </span>
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--color-btn)]" : "bg-[color-mix(in_srgb,var(--color-main)_15%,transparent)]",
          disabled ? "opacity-60" : "",
        ].join(" ")}
        aria-hidden
      >
        <span
          className={[
            `absolute left-1 top-1 size-5 rounded-full transition-transform ${checked ? "bg-[var(--color-btn-label)]" : "bg-[var(--color-surface)]"}`,
            checked ? "translate-x-5" : "",
          ].join(" ")}
        />
      </span>
    </label>
  );
}
