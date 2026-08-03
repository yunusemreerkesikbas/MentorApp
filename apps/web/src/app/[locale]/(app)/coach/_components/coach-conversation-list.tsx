"use client";
import { Ellipsis, Trash2 } from "lucide-react";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { FormError } from "@/components/form";
import { Link } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useCoachSession } from "./coach-session-context";

/**
 * Flat conversation list (ChatGPT-style): title only, row hover, ⋯ menu → delete.
 */
export function CoachConversationList({
  variant = "sheet",
  onSelectConversation,
}: {
  variant?: "sheet" | "inline";
  onSelectConversation?: () => void;
} = {}) {
  const t = useTranslations("coach.conversations");
  const tLanding = useTranslations("coach.landing");
  const dialog = useMentorDialog();
  const {
    conversations,
    conversationStatus,
    conversationError,
    refreshConversations,
    deleteConversation,
    activeConversationId,
  } = useCoachSession();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const spaced = variant === "inline" ? "mt-4" : "";

  if (
    conversationStatus === "idle" ||
    conversationStatus === "loading"
  ) {
    return (
      <SkeletonGroup
        label={t("loading")}
        className={`${spaced} flex flex-col gap-1.5`.trim()}
      >
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full rounded-[10px]" />
        <Skeleton className="h-9 w-full rounded-[10px]" />
      </SkeletonGroup>
    );
  }

  if (conversationStatus === "error") {
    return (
      <section className={`${spaced} px-1`.trim()}>
        <FormError message={conversationError ?? t("load_error")} />
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => void refreshConversations()}
        >
          {t("retry")}
        </Button>
      </section>
    );
  }

  if (conversations.length === 0) {
    return (
      <p
        className={`${spaced} px-2 text-sm`.trim()}
        style={{ color: "var(--color-secondary)" }}
        role="status"
      >
        {tLanding("history_empty")}
      </p>
    );
  }

  async function remove(id: string, title: string) {
    setMenuId(null);
    const ok = await dialog.confirm({
      title: t("delete_confirm_title"),
      message: t("delete_confirm_message", { title }),
      confirmLabel: t("delete_confirm_yes"),
      cancelLabel: t("delete_confirm_no"),
    });
    if (!ok) return;
    setPendingId(id);
    try {
      await deleteConversation(id);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className={spaced || undefined}>
      <h2
        className="mb-1.5 px-2 text-xs font-semibold"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {conversations.map((conversation) => {
          const active = conversation.id === activeConversationId;
          const menuOpen = menuId === conversation.id;
          return (
            <li key={conversation.id} className="group relative">
              <div
                className={[
                  "flex items-center gap-1 rounded-[10px] transition-colors motion-reduce:transition-none",
                  active || menuOpen
                    ? "bg-black/[0.06]"
                    : "hover:bg-black/[0.05]",
                ].join(" ")}
              >
                <Link
                  href={{
                    pathname: "/coach/chat",
                    query: { c: conversation.id },
                  }}
                  onClick={() => onSelectConversation?.()}
                  className="flex min-h-10 min-w-0 flex-1 items-center px-2.5 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <span className="truncate">{conversation.title}</span>
                </Link>
                <ConversationRowMenu
                  open={menuOpen}
                  onOpenChange={(next) =>
                    setMenuId(next ? conversation.id : null)
                  }
                  disabled={pendingId === conversation.id}
                  ariaLabel={t("menu_aria", { title: conversation.title })}
                  deleteLabel={t("delete_confirm_yes")}
                  onDelete={() =>
                    void remove(conversation.id, conversation.title)
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ConversationRowMenu({
  open,
  onOpenChange,
  disabled,
  ariaLabel,
  deleteLabel,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
  ariaLabel: string;
  deleteLabel: string;
  onDelete: () => void;
}) {
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <div className="relative shrink-0 pr-1">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(!open);
        }}
        className={[
          "inline-flex size-8 items-center justify-center rounded-[8px] transition-[opacity,background-color,color] motion-reduce:transition-none",
          "hover:bg-black/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50",
          // Touch: always visible. Pointer: reveal on row hover / when open.
          open
            ? "opacity-100"
            : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100",
        ].join(" ")}
        style={{ color: "var(--color-secondary)" }}
      >
        <Ellipsis className="size-4" strokeWidth={2.25} aria-hidden />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => onOpenChange(false)}
          />
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-[9.5rem] overflow-hidden rounded-[10px] bg-white py-1 shadow-[var(--shadow-card)]"
            style={{
              border: "1px solid color-mix(in srgb, var(--color-main) 8%, transparent)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-black/[0.04] disabled:opacity-50 focus-visible:outline-none focus-visible:bg-black/[0.04]"
              style={{ color: "var(--color-danger)" }}
            >
              <Trash2 className="size-3.5 shrink-0" aria-hidden />
              {deleteLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
