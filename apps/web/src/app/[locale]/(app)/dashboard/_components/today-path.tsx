"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Check, GraduationCap, Play, Plus } from "lucide-react";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { Link, useRouter } from "@/i18n/navigation";
import type { StudySessionHref } from "@/lib/plan-study-session-link";
import type {
  PathChest,
  PathNode,
  TodayPath as TodayPathModel,
} from "./today-path-model";

const NODE_BASE =
  "relative grid shrink-0 place-items-center rounded-full outline-none transition-transform duration-[120ms] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-0.5 motion-reduce:transition-none";

const NODE_TONE = {
  done: "size-12 bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)] sm:size-14",
  current:
    "size-16 bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_5px_0_var(--play-cta-edge),0_0_0_8px_var(--play-selected)] sm:size-[72px]",
  upcoming:
    "size-12 bg-[var(--play-track)] text-[var(--color-secondary)] shadow-[0_4px_0_color-mix(in_srgb,var(--play-track),var(--color-main)_12%)] sm:size-14",
} as const;

type PanelT = ReturnType<typeof useTranslations<"panel">>;

/** The chest glyph from the canvas; lucide has no chest, and a gift box reads as a present. */
export function ChestIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M3 13h18M5 9V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2" />
      <rect x="10.5" y="11.5" width="3" height="4" rx="1" />
    </svg>
  );
}

/**
 * The day as a path: what is done, the next step (the only big node), what follows, and the
 * weekly chest at the end. A node opens a small menu instead of acting on the tap, so a thumb
 * brushing the path never starts a session or ticks a task by accident.
 */
export function TodayPath({
  path,
  busyTaskId,
  sessionHref,
  onSetStatus,
}: {
  path: TodayPathModel;
  busyTaskId: string | null;
  sessionHref: (task: PlanTaskDto) => StudySessionHref;
  onSetStatus: (task: PlanTaskDto, status: PlanTaskStatus) => void;
}) {
  const t = useTranslations("panel");
  const lead = path.hiddenBefore > 0 ? 1 : 0;

  return (
    <ol
      className="-mx-5 flex overflow-x-auto px-5 pb-1 pt-9 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0"
      aria-label={t("path_label")}
    >
      {path.hiddenBefore > 0 ? (
        <PathItem
          index={0}
          reached
          title={t("path_earlier_done", { count: path.hiddenBefore })}
          node={
            <span className={`${NODE_BASE} ${NODE_TONE.done}`} aria-hidden>
              <Check className="size-5" strokeWidth={3} />
            </span>
          }
        />
      ) : null}

      {path.total === 0 ? (
        <PathItem
          index={0}
          reached={false}
          title={t("path_first_step")}
          meta={t("path_first_step_meta")}
          node={
            <Link
              href={{ pathname: "/plan", query: { add: "1", source: "dashboard" } }}
              className={`${NODE_BASE} size-12 border-2 border-dashed border-[color-mix(in_srgb,var(--color-secondary)_45%,transparent)] bg-[var(--color-surface)] text-[var(--color-secondary)] sm:size-14`}
              aria-label={t("path_first_step_aria")}
            >
              <Plus className="size-6" strokeWidth={2.5} aria-hidden />
            </Link>
          }
        />
      ) : null}

      {path.nodes.map((node, offset) => {
        const meta = nodeMeta(node, t);
        return (
          <PathItem
            key={node.task.id}
            index={offset + lead}
            reached={node.state !== "upcoming"}
            title={node.task.title}
            meta={meta}
            node={
              <TaskNode
                node={node}
                meta={meta}
                busy={busyTaskId === node.task.id}
                sessionHref={sessionHref}
                onSetStatus={onSetStatus}
              />
            }
          />
        );
      })}

      {path.hiddenAfter > 0 ? (
        <PathItem
          index={1}
          reached={false}
          title={t("path_more")}
          node={
            <Link
              href="/plan"
              className={`${NODE_BASE} ${NODE_TONE.upcoming} text-sm font-black`}
              aria-label={t("path_more_aria", { count: path.hiddenAfter })}
            >
              +{path.hiddenAfter}
            </Link>
          }
        />
      ) : null}

      {path.chest ? (
        <PathItem
          index={1}
          reached={path.cta.kind === "DAY_COMPLETE"}
          title={t("chest_title")}
          meta={chestMeta(path.chest, t)}
          node={<ChestNode chest={path.chest} />}
        />
      ) : null}
    </ol>
  );
}

/** One stop. The connector to the previous stop is drawn by the stop itself, so no measuring. */
function PathItem({
  index,
  reached,
  node,
  title,
  meta,
}: {
  index: number;
  reached: boolean;
  node: ReactNode;
  title: string;
  meta?: string | null;
}) {
  return (
    <li className="relative flex w-[76px] shrink-0 flex-col items-center gap-2 px-1 text-center sm:w-auto sm:min-w-0 sm:flex-1">
      {index > 0 ? (
        <span
          aria-hidden
          className={`absolute right-1/2 top-[30px] z-0 h-1 w-full rounded-full sm:top-[34px] ${reached ? "bg-[var(--play-cta)]" : "bg-[var(--play-track)]"}`}
        />
      ) : null}
      <div className="relative z-[1] flex h-16 items-center sm:h-[72px]">
        {node}
      </div>
      <span className="line-clamp-2 w-full text-[13px] font-extrabold leading-tight text-[var(--color-main)]">
        {title}
      </span>
      {meta ? (
        <span className="-mt-1 w-full truncate text-xs font-semibold text-[var(--color-secondary)]">
          {meta}
        </span>
      ) : null}
    </li>
  );
}

function nodeMeta(node: PathNode, t: PanelT): string {
  const { task, state } = node;
  return [
    state === "done"
      ? t("node_done")
      : node.rangeMinutes != null
        ? t("node_minutes", { minutes: node.rangeMinutes })
        : task.subject && task.subject !== task.title
          ? task.subject
          : null,
    node.fromCoach ? t("node_from_coach") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function chestMeta(chest: PathChest, t: PanelT): string {
  return chest.open
    ? t("chest_open_meta", { reward: chest.reward })
    : t("chest_meta", {
        current: chest.current,
        target: chest.target,
        reward: chest.reward,
      });
}

function TaskNode({
  node,
  meta,
  busy,
  sessionHref,
  onSetStatus,
}: {
  node: PathNode;
  meta: string;
  busy: boolean;
  sessionHref: (task: PlanTaskDto) => StudySessionHref;
  onSetStatus: (task: PlanTaskDto, status: PlanTaskStatus) => void;
}) {
  const t = useTranslations("panel");
  const router = useRouter();
  const { task, state } = node;
  const Icon = state === "done" ? Check : state === "current" ? Play : BookOpen;

  return (
    <PopoverMenu
      align="left"
      menuClassName="w-56 py-1"
      trigger={({ open, setOpen, menuId }) => (
        <button
          type="button"
          className={`${NODE_BASE} ${NODE_TONE[state]} cursor-pointer disabled:cursor-wait`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={[
            task.title,
            t(`node_state_${state}`),
            // A done node's meta is "bitti" again; only its coach mark is still news.
            state === "done" ? (node.fromCoach ? t("node_from_coach") : null) : meta,
          ]
            .filter(Boolean)
            .join(", ")}
          disabled={busy}
          onClick={() => setOpen(!open)}
          data-testid="today-path-node"
        >
          {state === "current" ? (
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[10px] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-black tracking-[0.02em] text-[var(--play-selected-ink)]">
              {t("node_next")}
            </span>
          ) : null}
          <Icon
            className={state === "current" ? "size-7 fill-current" : "size-6"}
            strokeWidth={state === "done" ? 3 : 2.2}
            aria-hidden
          />
          {node.fromCoach ? (
            <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--coach-accent)] text-[var(--color-bg)]">
              <GraduationCap className="size-3" strokeWidth={2.5} aria-hidden />
            </span>
          ) : null}
        </button>
      )}
    >
      {state === "done" ? (
        <PopoverMenuItem onClick={() => onSetStatus(task, "PENDING")}>
          {t("node_undo")}
        </PopoverMenuItem>
      ) : (
        <>
          <PopoverMenuItem onClick={() => router.push(sessionHref(task))}>
            {t("node_start")}
          </PopoverMenuItem>
          <PopoverMenuItem onClick={() => onSetStatus(task, "DONE")}>
            {t("node_mark_done")}
          </PopoverMenuItem>
        </>
      )}
    </PopoverMenu>
  );
}

function ChestNode({ chest }: { chest: PathChest }) {
  const t = useTranslations("panel");

  return (
    <span
      role="img"
      aria-label={`${t("chest_title")}, ${chestMeta(chest, t)}`}
      data-testid="today-path-chest"
      className={[
        "grid size-12 place-items-center rounded-full sm:size-14",
        chest.open
          ? "bg-[color-mix(in_srgb,var(--color-streak-core)_65%,var(--color-surface))] text-[color-mix(in_srgb,var(--color-star)_35%,var(--color-main))] shadow-[0_4px_0_color-mix(in_srgb,var(--color-star)_70%,var(--color-main)_15%),0_0_0_8px_color-mix(in_srgb,var(--color-streak-core)_22%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--color-streak-core)_30%,var(--color-surface))] text-[color-mix(in_srgb,var(--color-star)_40%,var(--color-main))] shadow-[0_4px_0_color-mix(in_srgb,var(--color-star)_55%,var(--color-surface))]",
      ].join(" ")}
    >
      <ChestIcon className="size-6" />
    </span>
  );
}
