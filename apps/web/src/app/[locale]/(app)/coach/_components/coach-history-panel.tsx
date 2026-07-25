"use client";

import SquarePen from "lucide-react/dist/esm/icons/square-pen.mjs";
import PanelLeft from "lucide-react/dist/esm/icons/panel-left.mjs";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CoachConversationList } from "./coach-conversation-list";
import { useCoachSession } from "./coach-session-context";

/**
 * Shared history body — used by the mobile drawer and the desktop rail.
 */
export function CoachHistoryPanel({
  titleId,
  onAfterNavigate,
  onCollapse,
}: {
  titleId?: string;
  /** e.g. close the mobile drawer after new chat / select. */
  onAfterNavigate?: () => void;
  /** Desktop rail only — collapse the sidebar. */
  onCollapse?: () => void;
}) {
  const t = useTranslations("coach.landing");
  const tHub = useTranslations("coach.hub");
  const router = useRouter();
  const session = useCoachSession();

  function handleNewChat() {
    session.startNewChat();
    onAfterNavigate?.();
    router.replace("/coach/chat");
  }

  return (
    <>
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-4"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
      >
        <h2
          id={titleId}
          className="min-w-0 flex-1 text-base font-bold leading-tight"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-main)",
          }}
        >
          {t("history_title")}
        </h2>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t("history_collapse")}
            data-testid="coach-history-collapse"
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          >
            <PanelLeft
              className="size-5"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-3 mentor-scrollarea">
        <button
          type="button"
          onClick={handleNewChat}
          data-testid="coach-history-new-chat"
          className="flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm font-semibold transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          <SquarePen
            className="size-[18px] shrink-0"
            strokeWidth={2.1}
            aria-hidden
          />
          {tHub("new_chat")}
        </button>
        <CoachConversationList
          variant="sheet"
          onSelectConversation={onAfterNavigate}
        />
      </div>
    </>
  );
}
