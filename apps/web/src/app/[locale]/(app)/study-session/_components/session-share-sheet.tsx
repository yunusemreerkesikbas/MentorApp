"use client";

import "@fontsource-variable/caveat/wght.css";
import { Copy, Download, Share } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import { Button, Modal } from "@mentor/ui";
import { PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { getProfileLinks } from "@/lib/profile-links";
import { shareDaypart } from "@/lib/session-share";
import {
  loadSessionShareCardAssets,
  renderSessionShareCardPng,
  type SessionShareCardAssets,
  type SessionShareCardModel,
} from "@/lib/session-share-card";
import { SessionSharePreview } from "./session-share-preview";

export interface SessionShareSheetProps {
  minutes: number;
  subject: string | null;
  /** The done card's star fill, 0.5 steps out of three. */
  stars: number;
  /** The room the session was studied in: the print's photo and the card's light. */
  theme: StudyRoomTheme;
  endedAt: Date;
  onClose: () => void;
}

type Outcome = "saved" | "copied" | "failed" | null;

/**
 * "Seansı paylaş": the session as a taped polaroid, 1080×1920 (canvas "Seans paylaşım kartı",
 * direction 1). A phone hands the PNG to the system share sheet; elsewhere it downloads or copies.
 * Feedback stays in the window: toasts sit under a native dialog's top layer.
 */
export function SessionShareSheet({
  minutes,
  subject,
  stars,
  theme,
  endedAt,
  onClose,
}: SessionShareSheetProps) {
  const t = useTranslations("session");
  const locale = useLocale();
  const [assets, setAssets] = useState<SessionShareCardAssets | null>(null);
  const [png, setPng] = useState<Blob | null>(null);
  const [broken, setBroken] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  // Read once: this window only renders in the browser (dynamic import, no SSR).
  const [canShareFile] = useState(canShareImage);
  const [canCopyImage] = useState(
    () => typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write),
  );

  const model = useMemo<SessionShareCardModel>(() => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const duration =
      hours === 0
        ? t("share_card_m", { minutes })
        : rest === 0
          ? t("share_card_h", { hours })
          : t("share_card_hm", { hours, minutes: rest });
    const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(endedAt);
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(endedAt);
    return {
      theme,
      caption: subject
        ? t("share_card_subject", { duration, subject })
        : t("share_card_focus", { duration }),
      placeLine: t("share_card_place_line", {
        place: t(`share_card_place_${theme}`),
        daypart: t(`share_card_daypart_${shareDaypart(endedAt)}`),
      }),
      dateLabel: t("share_card_date", { day, weekday }),
      stars,
      siteLabel: siteHost(),
    };
  }, [t, locale, minutes, subject, stars, theme, endedAt]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadSessionShareCardAssets(model.theme);
        if (cancelled) return;
        setAssets(loaded);
        const blob = await renderSessionShareCardPng(model, loaded);
        if (!cancelled) setPng(blob);
      } catch {
        if (!cancelled) setBroken(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [model]);

  const fileName = t("share_file_name");

  const handleShare = async () => {
    if (!png || sharing) return;
    setSharing(true);
    setOutcome(null);
    try {
      await navigator.share({
        files: [new File([png], fileName, { type: "image/png" })],
        text: t("share_text", { minutes }),
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setOutcome("failed");
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = () => {
    if (!png) return;
    const url = URL.createObjectURL(png);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setOutcome("saved");
  };

  const handleCopy = async () => {
    if (!png) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setOutcome("copied");
    } catch {
      setOutcome("failed");
    }
  };

  const preparing = !png && !broken;
  const iconProps = { size: 20, strokeWidth: 2.25, "aria-hidden": true } as const;

  return (
    <Modal
      title={t("share_sheet_title")}
      closeLabel={t("share_close")}
      onClose={onClose}
      placement="sheet"
      size="wide"
    >
      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-stretch lg:gap-10">
        <SessionSharePreview
          model={model}
          assets={assets}
          label={t("share_card_label", { caption: model.caption, place: model.placeLine })}
        />
        <div className="flex w-full min-w-0 flex-col gap-4 lg:justify-between lg:py-2">
          <div className="flex flex-col gap-2 text-center lg:text-left">
            <p className="hidden text-base leading-relaxed text-[var(--color-secondary)] lg:block">
              {t("share_sheet_body")}
            </p>
            <p className="text-body-sm leading-normal text-[var(--color-secondary)]">
              {t("share_privacy")}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {broken || outcome === "failed" ? (
              <p role="alert" className="text-center text-body-sm font-semibold text-[var(--color-main)] lg:text-left">
                {broken ? t("share_card_failed") : t("share_error_title")}
              </p>
            ) : (
              <p role="status" className="min-h-5 text-center text-body-sm font-semibold text-[var(--color-main)] lg:text-left">
                {outcome === "saved" ? t("share_saved") : outcome === "copied" ? t("share_copied_image") : ""}
              </p>
            )}
            {canShareFile ? (
              <>
                <Button fullWidth busy={preparing || sharing} disabled={!png} onClick={() => void handleShare()}>
                  <Share {...iconProps} />
                  {t("share_action")}
                </Button>
                <button
                  type="button"
                  disabled={!png}
                  onClick={handleDownload}
                  className={`${PANEL_QUIET_LINK} w-full justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <Download size={18} strokeWidth={2.25} aria-hidden />
                  {t("share_save")}
                </button>
              </>
            ) : (
              <>
                <Button fullWidth busy={preparing} disabled={!png} onClick={handleDownload}>
                  <Download {...iconProps} />
                  {t("share_download")}
                </Button>
                {canCopyImage ? (
                  <Button variant="secondary" fullWidth disabled={!png} onClick={() => void handleCopy()}>
                    <Copy {...iconProps} />
                    {t("share_copy_image")}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function canShareImage(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([""], "card.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

function siteHost(): string {
  const { shareUrl } = getProfileLinks();
  try {
    return new URL(shareUrl).host;
  } catch {
    return shareUrl;
  }
}
