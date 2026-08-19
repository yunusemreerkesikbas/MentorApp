"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, FileText, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Attachment, CommentView } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";

import { resolveApiUrl } from "@/lib/api-base";
import { postComment, postReply } from "@/lib/forum";
import { relativeTime } from "@/lib/relative-time";

import { ThreadComposer } from "../[slug]/_components/thread-composer";
import { AuthorAvatar } from "./author-avatar";
import { AuthorLink } from "./author-link";

const SOURCE_PREVIEW_MAX_LENGTH = 240;

export type QuickReplyTarget = {
  targetType: "thread" | "post";
  targetId: string;
  zoneId?: string;
  author: {
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  body: string;
  attachments: Attachment[];
  onPendingChange?: (delta: 1 | -1) => void;
  onCreated?: (comment: CommentView) => void;
};

type CommunityQuickReplyContextValue = {
  openQuickReply: (target: QuickReplyTarget) => void;
};

const CommunityQuickReplyContext = createContext<CommunityQuickReplyContextValue | null>(null);

export function CommunityQuickReplyProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<QuickReplyTarget | null>(null);
  const [visible, setVisible] = useState(false);

  const openQuickReply = useCallback((nextTarget: QuickReplyTarget) => {
    setTarget(nextTarget);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!target || !visible) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [target, visible]);

  const requestClose = useCallback(() => setVisible(false), []);
  const finishClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setTarget(null);
  }, []);

  const submit = useCallback(
    async (body: string, attachments: AttachmentInput[]) => {
      if (!target) return;
      target.onPendingChange?.(1);
      try {
        const created =
          target.targetType === "thread"
            ? await postComment(target.targetId, body, attachments)
            : await postReply(target.targetId, body, attachments);
        target.onCreated?.(created);
        requestClose();
      } catch (error) {
        target.onPendingChange?.(-1);
        throw error;
      }
    },
    [requestClose, target],
  );

  const contextValue = useMemo(() => ({ openQuickReply }), [openQuickReply]);
  const sourceText = target ? truncateSourcePreview(target.body) : "";
  const image = target?.attachments.find((attachment) => attachment.kind === "image");
  const file = target?.attachments.find((attachment) => attachment.kind === "file");
  const imageUrl = image ? resolveApiUrl(image.url) : null;

  return (
    <CommunityQuickReplyContext.Provider value={contextValue}>
      {children}
      <dialog
        ref={dialogRef}
        className="community-quick-reply-dialog"
        aria-labelledby="community-quick-reply-title"
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onClose={() => {
          setVisible(false);
          setTarget(null);
        }}
      >
        <AnimatePresence onExitComplete={finishClose}>
          {visible && target ? (
            <>
              <motion.div
                key="quick-reply-scrim"
                className="community-quick-reply-dialog__scrim"
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
                onClick={requestClose}
              />
              <motion.section
                key="quick-reply-panel"
                className="community-quick-reply-panel"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
                transition={
                  reduceMotion
                    ? { duration: 0.01 }
                    : { duration: visible ? 0.24 : 0.16, ease: [0.22, 1, 0.36, 1] }
                }
              >
                <header className="community-quick-reply-panel__header">
                  <h2 id="community-quick-reply-title">{t("quick_reply_title")}</h2>
                  <button type="button" onClick={requestClose} aria-label={t("close")}>
                    <X size={20} aria-hidden />
                  </button>
                </header>

                <div className="community-quick-reply-panel__body">
                  <div className="community-quick-reply-source">
                    <div className="community-quick-reply-source__avatar">
                      <AuthorLink
                        username={target.author.username}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
                      >
                        <AuthorAvatar
                          name={target.author.displayName}
                          src={target.author.avatarUrl}
                          size={36}
                        />
                      </AuthorLink>
                      <span aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <strong className="truncate text-[15px] text-[var(--color-main)]">
                          {target.author.displayName}
                        </strong>
                        {target.author.username ? (
                          <AuthorLink
                            username={target.author.username}
                            className="truncate text-[13px] text-[var(--color-secondary)] transition-colors hover:text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                          >
                            @{target.author.username}
                          </AuthorLink>
                        ) : null}
                        <span className="text-xs text-[var(--color-secondary)]">
                          · {relativeTime(target.createdAt, locale)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[15px] leading-[22px] text-[var(--color-body)]">
                        {sourceText}
                      </p>
                      {imageUrl ? (
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t("quick_reply_open_media")}
                          className="mt-3 flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-soft)] px-3 text-[13px] text-[var(--community-blue-ink)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                        >
                          <span className="min-w-0 flex-1 truncate">{imageUrl}</span>
                          <ExternalLink size={16} className="shrink-0" aria-hidden />
                        </a>
                      ) : file ? (
                        <div className="mt-3 flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-secondary)]">
                          <FileText size={18} aria-hidden />
                          <span className="truncate">{file.fileName ?? t("attach_file")}</span>
                        </div>
                      ) : null}
                      <p className="mt-3 text-[13px] text-[var(--color-secondary)]">
                        {t.rich("quick_reply_to", {
                          handle: target.author.username
                            ? `@${target.author.username}`
                            : target.author.displayName,
                          username: (chunks) =>
                            target.author.username ? (
                              <AuthorLink
                                username={target.author.username}
                                className="text-[var(--community-blue-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                              >
                                {chunks}
                              </AuthorLink>
                            ) : (
                              <span className="font-semibold text-[var(--color-main)]">{chunks}</span>
                            ),
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="community-quick-reply-composer">
                    <ThreadComposer
                      key={`${target.targetType}-${target.targetId}`}
                      placeholder={t("reply_placeholder")}
                      submitLabel={t("reply_submit")}
                      onSubmit={submit}
                      zoneId={target.zoneId}
                      focusOnMount
                      variant="reply-dialog"
                    />
                  </div>
                </div>
              </motion.section>
            </>
          ) : null}
        </AnimatePresence>
      </dialog>
    </CommunityQuickReplyContext.Provider>
  );
}

export function useCommunityQuickReply() {
  const context = useContext(CommunityQuickReplyContext);
  if (!context) {
    throw new Error("useCommunityQuickReply must be used within CommunityQuickReplyProvider");
  }
  return context;
}

export function truncateSourcePreview(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > SOURCE_PREVIEW_MAX_LENGTH
    ? `${trimmed.slice(0, SOURCE_PREVIEW_MAX_LENGTH).trimEnd()}…`
    : trimmed;
}
