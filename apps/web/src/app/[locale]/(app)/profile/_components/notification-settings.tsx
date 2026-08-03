"use client";
import { Bell, Mail, Smartphone } from "lucide-react";

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
    } catch (err) {
      if (rollback.emailEnabled !== undefined)
        setEmailEnabled(rollback.emailEnabled);
      if (rollback.pushEnabled !== undefined)
        setPushEnabled(rollback.pushEnabled);
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
      <div className="mt-3 divide-y divide-black/10 overflow-hidden rounded-[var(--radius-card)]">
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
    <label className="flex min-h-16 min-w-0 cursor-pointer items-center justify-between gap-3 bg-white px-3 py-3 transition-colors hover:bg-black/[0.03] focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)] focus-within:ring-offset-2">
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
          checked ? "bg-[var(--color-main)]" : "bg-black/15",
          disabled ? "opacity-60" : "",
        ].join(" ")}
        aria-hidden
      >
        <span
          className={[
            "absolute left-1 top-1 size-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-5" : "",
          ].join(" ")}
        />
      </span>
    </label>
  );
}
