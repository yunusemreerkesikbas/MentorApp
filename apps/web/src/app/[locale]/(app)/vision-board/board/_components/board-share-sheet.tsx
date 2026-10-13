"use client";

import {
  ChevronRight,
  Copy,
  Download,
  LoaderCircle,
  PanelTop,
  Share2,
  Smartphone,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ThreadView, VisionBoardDoc, ZoneView } from "@mentor/types";
import { Button, Modal } from "@mentor/ui";
import { PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import {
  BoardExportTaintedError,
  canShareImageFile,
  downloadBlob,
  renderBoardToBlob,
  renderBoardWallpaperBlob,
} from "@/components/vision-board/board-export";
import { listZones } from "@/lib/forum";
import { BoardShareCommunity } from "./board-share-community";

type ShareFormat = "board" | "wallpaper";

/** A format's picture once drawn, or why it could not be. */
type Render = { blob: Blob; url: string } | "failed" | "blocked";

const FORMATS: { id: ShareFormat; icon: typeof PanelTop; labelKey: "nav_board" | "share_format_wallpaper" }[] = [
  { id: "board", icon: PanelTop, labelKey: "nav_board" },
  { id: "wallpaper", icon: Smartphone, labelKey: "share_format_wallpaper" },
];

/**
 * "Panonu paylaş": the board as a picture, in the frame it wears, or hung on a wall as a phone
 * wallpaper. A phone hands the PNG to the system share sheet; elsewhere it downloads or copies.
 * A second step posts it to a community room. Only a failure speaks, and inside the window:
 * toasts sit under a native dialog's top layer.
 */
export function BoardShareSheet({
  doc,
  onClose,
  onShared,
}: {
  doc: VisionBoardDoc;
  onClose: () => void;
  /** The board went into a room as this post; the caller closes the window and says so. */
  onShared: (thread: ThreadView) => void;
}) {
  const t = useTranslations("vision.board");
  // The board as it was when the window opened: the window is modal, nothing changes under it.
  const [snapshot] = useState(doc);
  const [step, setStep] = useState<"picture" | "community">("picture");
  /*
   * The viewer's rooms, or null while unknown. It stays null when the forum is switched off for
   * them (404 FORUM_DISABLED) or the read fails, and the community row simply is not offered: a
   * way in that can only end in an error is worse than no way in.
   */
  const [zones, setZones] = useState<ZoneView[] | null>(null);
  useEffect(() => {
    let active = true;
    listZones()
      .then((result) => {
        if (active) setZones(result.items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [format, setFormat] = useState<ShareFormat>("board");
  const [renders, setRenders] = useState<Partial<Record<ShareFormat, Render>>>({});
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  // Read once: this window only renders in the browser (dynamic import, no SSR).
  const [canShareFile] = useState(canShareImageFile);
  const [canCopyImage] = useState(
    () => typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write),
  );

  /** Preview URLs, kept only so they can be revoked when the window closes. */
  const previewUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  // Each format is drawn the first time it is looked at, then kept for the window's life.
  const current = renders[format];
  useEffect(() => {
    if (current) return;
    let cancelled = false;
    const draw = format === "board" ? renderBoardToBlob : renderBoardWallpaperBlob;
    draw(snapshot)
      .then((blob): Render => {
        const url = URL.createObjectURL(blob);
        previewUrls.current.push(url);
        return { blob, url };
      })
      .catch((error): Render => (error instanceof BoardExportTaintedError ? "blocked" : "failed"))
      .then((render) => {
        if (!cancelled) setRenders((drawn) => ({ ...drawn, [format]: render }));
      });
    return () => {
      cancelled = true;
    };
  }, [current, format, snapshot]);

  const picture = typeof current === "object" ? current : null;
  const preparing = current === undefined;
  const fileName = `${t(format === "board" ? "file_name" : "file_name_wallpaper")}.png`;

  const handleShare = async () => {
    if (!picture || sharing) return;
    setSharing(true);
    setShareFailed(false);
    try {
      await navigator.share({ files: [new File([picture.blob], fileName, { type: "image/png" })] });
    } catch (error) {
      // Dismissing the system sheet is a normal outcome, not a failure to report.
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareFailed(true);
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    if (!picture) return;
    setShareFailed(false);
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": picture.blob })]);
    } catch {
      setShareFailed(true);
    }
  };

  const handleDownload = () => {
    if (picture) downloadBlob(picture.blob, fileName);
  };

  const iconProps = { size: 20, strokeWidth: 2.25, "aria-hidden": true } as const;
  const problem =
    current === "blocked"
      ? t("export_blocked")
      : current === "failed"
        ? t("export_failed")
        : shareFailed
          ? t("share_failed")
          : null;

  if (step === "community" && zones) {
    const boardPicture = renders.board;
    return (
      <Modal
        title={t("share_community")}
        closeLabel={t("preview_close")}
        onClose={onClose}
        placement="sheet"
      >
        <BoardShareCommunity
          doc={snapshot}
          zones={zones}
          previewUrl={typeof boardPicture === "object" ? boardPicture.url : null}
          onBack={() => setStep("picture")}
          onShared={onShared}
        />
      </Modal>
    );
  }

  return (
    <Modal
      title={t("share_sheet_title")}
      closeLabel={t("preview_close")}
      onClose={onClose}
      placement="sheet"
    >
      {/* A fixed box, so switching between a wide board and a tall wallpaper moves nothing below. */}
      <div className="flex h-64 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-surface-container)] p-4 sm:h-72">
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- a blob drawn a moment ago, not a remote asset
          <img
            src={picture.url}
            alt={t(format === "board" ? "share_preview_board" : "share_preview_wallpaper")}
            className={`max-h-full max-w-full object-contain ${format === "wallpaper" ? "rounded-[var(--radius-card)] shadow-[var(--shadow-card)]" : ""}`}
          />
        ) : preparing ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-secondary)]"
          >
            <LoaderCircle
              aria-hidden
              size={18}
              className="animate-spin motion-reduce:animate-none"
            />
            {t("share_preparing")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div role="group" aria-label={t("share_format")} className="grid grid-cols-2 gap-2">
          {FORMATS.map(({ id, icon: Icon, labelKey }) => {
            const active = format === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFormat(id);
                  setShareFailed(false);
                }}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none ${
                  active
                    ? "bg-[var(--play-selected)] font-extrabold text-[var(--play-selected-ink)] shadow-[inset_0_0_0_1.5px_var(--play-cta)]"
                    : "bg-[var(--color-surface-container)] font-bold text-[var(--color-body)]"
                }`}
              >
                <Icon aria-hidden size={18} />
                {t(labelKey)}
              </button>
            );
          })}
        </div>
        {/* Always there, so picking the wallpaper does not push the buttons down a line. */}
        <p className="min-h-5 text-center text-xs font-semibold text-[var(--color-secondary)]">
          {format === "wallpaper" ? t("share_wallpaper_hint") : null}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {problem ? (
          <p role="alert" className="text-center text-body-sm font-semibold text-[var(--color-main)]">
            {problem}
          </p>
        ) : null}
        {canShareFile ? (
          <>
            <Button
              fullWidth
              busy={preparing || sharing}
              disabled={!picture}
              onClick={() => void handleShare()}
            >
              {preparing || sharing ? null : <Share2 {...iconProps} />}
              {t("share")}
            </Button>
            <button
              type="button"
              disabled={!picture}
              onClick={handleDownload}
              className={`${PANEL_QUIET_LINK} w-full justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Download size={18} strokeWidth={2.25} aria-hidden />
              {t("download")}
            </button>
          </>
        ) : (
          <>
            <Button fullWidth busy={preparing} disabled={!picture} onClick={handleDownload}>
              {/* The busy spinner takes the icon's place; two glyphs before one word is a stutter. */}
              {preparing ? null : <Download {...iconProps} />}
              {t("download")}
            </Button>
            {canCopyImage ? (
              <Button
                variant="secondary"
                fullWidth
                disabled={!picture}
                onClick={() => void handleCopy()}
              >
                <Copy {...iconProps} />
                {t("share_copy")}
              </Button>
            ) : null}
          </>
        )}
      </div>

      {/* A row across the window's foot: the other place the board can go, apart from a file. */}
      {zones ? (
        <button
          type="button"
          onClick={() => {
            // The post carries the board itself, so that is the picture the next step shows.
            setFormat("board");
            setShareFailed(false);
            setStep("community");
          }}
          className="-mx-6 -mb-5 flex min-h-14 cursor-pointer items-center gap-3 border-t border-[var(--play-line)] px-6 text-left text-body-sm font-extrabold text-[var(--play-selected-ink)] outline-none transition-colors hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
        >
          <Users aria-hidden size={20} />
          <span className="flex-1">{t("share_community")}</span>
          <ChevronRight aria-hidden size={18} />
        </button>
      ) : null}
    </Modal>
  );
}
