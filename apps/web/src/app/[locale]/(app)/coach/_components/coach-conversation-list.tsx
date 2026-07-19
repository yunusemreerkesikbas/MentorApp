"use client";

import { useState } from "react";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import MessageSquare from "lucide-react/dist/esm/icons/message-square.mjs";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useCoachSession } from "./coach-session-context";

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
}

/**
 * "Son sohbetler" — the user's chat threads on the /coach hub. Tapping one opens it (`?c=<id>`);
 * the trash icon deletes it after a confirm (same trust line as subscription cancel).
 */
export function CoachConversationList() {
  const t = useTranslations("coach.conversations");
  const locale = useLocale();
  const dialog = useMentorDialog();
  const { conversations, deleteConversation } = useCoachSession();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (conversations.length === 0) return null;

  async function remove(id: string, title: string) {
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
    <section className="mt-4">
      <h2
        className="mb-2 px-1 text-sm font-bold"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-2">
        {conversations.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 rounded-[var(--radius-card)] bg-white px-3 py-2 shadow-[var(--shadow-card)]"
          >
            <Link
              href={{ pathname: "/coach/chat", query: { c: c.id } }}
              className="flex min-h-11 flex-1 items-center gap-3 overflow-hidden transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            >
              <MessageSquare
                className="size-4 shrink-0"
                style={{ color: "var(--color-progress)" }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-sm font-bold"
                  style={{ color: "var(--color-main)" }}
                >
                  {c.title}
                </span>
                <span
                  className="block text-xs"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {formatDate(c.lastMessageAt, locale)}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void remove(c.id, c.title)}
              disabled={pendingId === c.id}
              aria-label={t("delete_aria", { title: c.title })}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{ color: "var(--color-secondary)" }}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
