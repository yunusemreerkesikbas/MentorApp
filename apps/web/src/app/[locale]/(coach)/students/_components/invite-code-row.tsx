"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Eye, EyeOff } from "lucide-react";
import type { MentorshipInviteCodeDto } from "@mentor/types";
import { formatDate } from "../../_components/mentorship-format";
import { maskInviteCode } from "./invite-code";

/**
 * The code at rest: masked, because it is a bearer secret (`invite-code.ts`) and copying never
 * needed it visible. Revealing is a deliberate press; so is copying, which sends the real code.
 */
export function InviteCodeRow({
  code,
  onCopy,
}: {
  code: MentorshipInviteCodeDto;
  /** Omitted while seats are closed: a code shared then only earns the student a refusal. */
  onCopy?: () => void;
}) {
  const t = useTranslations("mentorship");
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex h-12 items-center gap-0.5 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] pl-3.5 pr-0.5">
      <code className="min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-[0.04em] text-[var(--color-main)]">
        {revealed ? code.code : maskInviteCode(code.code)}
      </code>
      <IconButton
        label={revealed ? t("invite_hide") : t("invite_reveal")}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </IconButton>
      {onCopy ? (
        <IconButton label={t("invite_copy")} onClick={onCopy}>
          <Copy className="size-5" aria-hidden />
        </IconButton>
      ) : null}
    </div>
  );
}

/** "8 Ekim 2026 tarihine kadar geçerli", with "Yeni kod üret" on the line under it. */
export function InviteExpiry({
  code,
  busy,
  onRotate,
}: {
  code: MentorshipInviteCodeDto;
  busy: boolean;
  onRotate: () => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();

  return (
    <div className="flex flex-col items-start text-caption font-semibold text-[var(--color-secondary)]">
      <span>{t("invite_expires", { date: formatDate(code.expiresAt, locale) })}</span>
      <button
        type="button"
        disabled={busy}
        onClick={onRotate}
        className="min-h-11 cursor-pointer font-extrabold text-[var(--play-selected-ink)] underline underline-offset-[3px] disabled:cursor-wait disabled:opacity-60"
      >
        {t("invite_rotate")}
      </button>
    </div>
  );
}

/** A 44px round icon control beside the 48px code well. The accessible name is the whole label. */
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--color-secondary)] outline-none transition-colors hover:bg-[var(--play-track)] hover:text-[var(--color-main)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      {children}
    </button>
  );
}
