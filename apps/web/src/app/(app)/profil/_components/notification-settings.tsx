"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@mentor/ui";
import type { NotificationPreferencesDto } from "@mentor/types";
import {
  ApiClientError,
  notificationsControllerGetPreferences,
  notificationsControllerSubscribePush,
  notificationsControllerUpdatePreferences,
} from "@mentor/api-client";
import { FormError } from "../../../../components/form";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function NotificationSettings() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
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
        setError(err instanceof ApiClientError ? err.message : "Ayarlar yüklenemedi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      if (rollback.emailEnabled !== undefined) setEmailEnabled(rollback.emailEnabled);
      if (rollback.pushEnabled !== undefined) setPushEnabled(rollback.pushEnabled);
      setError(err instanceof ApiClientError ? err.message : "Ayarlar kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    if (!vapidPublicKey) {
      setPushStatus("Push yapılandırması henüz hazır değil.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("Tarayıcın web push desteklemiyor.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushStatus("Bildirim izni verilmedi.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setPushStatus("Abonelik oluşturulamadı.");
        return;
      }

      await notificationsControllerSubscribePush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      await savePreferences({ pushEnabled: true }, { pushEnabled });
      setPushStatus("Push bildirimleri açıldı.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Push açılamadı.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <p style={{ color: "var(--color-secondary)" }}>Bildirim ayarları yükleniyor…</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2
        className="mb-3 text-lg font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Bildirim ayarları
      </h2>
      {error ? <FormError message={error} /> : null}
      <label
        className="mb-3 flex min-h-11 cursor-pointer items-center gap-3 text-base"
        style={{ color: "var(--color-main)" }}
      >
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0"
          checked={emailEnabled}
          disabled={saving}
          onChange={(e) => {
            const prev = emailEnabled;
            const next = e.target.checked;
            setEmailEnabled(next);
            void savePreferences({ emailEnabled: next }, { emailEnabled: prev });
          }}
        />
        E-posta hatırlatmaları
      </label>
      <label
        className="mb-4 flex min-h-11 cursor-pointer items-center gap-3 text-base"
        style={{ color: "var(--color-main)" }}
      >
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0"
          checked={pushEnabled}
          disabled={saving}
          onChange={(e) => {
            const prev = pushEnabled;
            const next = e.target.checked;
            setPushEnabled(next);
            void savePreferences({ pushEnabled: next }, { pushEnabled: prev });
          }}
        />
        Push bildirimleri
      </label>
      <Button type="button" disabled={saving} onClick={() => void enablePush()}>
        Push izni ver
      </Button>
      {pushStatus ? (
        <p className="mt-3 text-sm" style={{ color: "var(--color-secondary)" }}>
          {pushStatus}
        </p>
      ) : null}
    </Card>
  );
}
