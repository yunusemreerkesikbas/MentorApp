"use client";

import { useTranslations } from "next-intl";
import { NotebookIcon as Notebook } from "@solar-icons/react/bold/notebook";
import { CheckCircleIcon as Completed } from "@solar-icons/react/bold/check-circle";
import { SquareAcademicCapIcon as AcademicCap } from "@solar-icons/react/bold/square-academic-cap";
import { PlayIcon as Play } from "@solar-icons/react/bold/play";
import { AddIcon as Plus } from "@solar-icons/react/linear/add";
import type { PlanTaskDto, PlanTaskStatus, WeeklyChestView } from "@mentor/types";
import {
  PATH_NODE_BASE as NODE_BASE,
  PATH_NODE_TONE as NODE_TONE,
  PathItem,
} from "@/components/panel/path-item";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { ChestArt } from "@/components/weekly-chest/chest-art";
import { chestLamps } from "@/components/weekly-chest/weekly-chest-model";
import { Link, useRouter } from "@/i18n/navigation";
import type { StudySessionHref } from "@/lib/plan-study-session-link";
import type { PathNode, TodayPath as TodayPathModel } from "./today-path-model";

type PanelT = ReturnType<typeof useTranslations<"panel">>;
type ChestT = ReturnType<typeof useTranslations<"weeklyChest">>;

/**
 * The day as a path: what is done, the next step (the only big node), what follows, and the
 * weekly chest at the end. A node opens a small menu instead of acting on the tap, so a thumb
 * brushing the path never starts a session or ticks a task by accident. The chest is the one
 * node that acts on the tap: it only ever opens a sheet or the opening scene.
 */
export function TodayPath({
  path,
  chest,
  busyTaskId,
  sessionHref,
  onSetStatus,
  onChestTap,
}: {
  path: TodayPathModel;
  chest: WeeklyChestView | null;
  busyTaskId: string | null;
  sessionHref: (task: PlanTaskDto) => StudySessionHref;
  onSetStatus: (task: PlanTaskDto, status: PlanTaskStatus) => void;
  onChestTap: (chest: WeeklyChestView) => void;
}) {
  const t = useTranslations("panel");
  const chestT = useTranslations("weeklyChest");
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
              <Completed size={20} className="size-5" />
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
              <Plus size={24} className="size-6" strokeWidth={2.5} aria-hidden />
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

      {chest ? (
        <PathItem
          index={1}
          reached={path.cta.kind === "DAY_COMPLETE" || chest.state !== "PROGRESS"}
          title={chestTitle(chest, chestT)}
          meta={chestMeta(chest, chestT)}
          node={<ChestNode chest={chest} onTap={() => onChestTap(chest)} />}
        />
      ) : null}
    </ol>
  );
}

function nodeMeta(node: PathNode, t: PanelT): string {
  const { task, state } = node;
  return [
    state === "done"
      ? t("node_done")
      : node.minutes === null ? t("node_stopwatch") : t("node_minutes", { minutes: node.minutes }),
    task.subject && task.subject !== task.title ? task.subject : null,
    node.fromCoach ? t("node_from_coach") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function chestTitle(chest: WeeklyChestView, t: ChestT): string {
  if (chest.state !== "READY") return t("title");
  return chest.carriedOver ? t("carried_title") : t("ready_title");
}

function chestMeta(chest: WeeklyChestView, t: ChestT): string {
  const reward = chest.reward ? t("reward", { amount: chest.reward.amount, unit: chest.reward.unit }) : null;
  if (chest.state === "READY") return t("ready_meta");
  if (chest.state === "OPENED") return reward ? t("opened_meta_reward", { reward }) : t("opened_meta");
  const progress = { current: Math.min(chest.current, chest.target), target: chest.target };
  return reward ? t("progress_meta_reward", { ...progress, reward }) : t("progress_meta", progress);
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
  const Icon = state === "done" ? Completed : state === "current" ? Play : Notebook;

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
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-card)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-black tracking-[0.02em] text-[var(--play-selected-ink)]">
              {t("node_next")}
            </span>
          ) : null}
          <Icon size={state === "current" ? 28 : 24}
            className={state === "current" ? "size-7 fill-current" : "size-6"}
            aria-hidden
          />
          {node.fromCoach ? (
            <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--coach-accent)] text-[var(--color-bg)]">
              <AcademicCap size={12} className="size-3" aria-hidden />
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

function ChestNode({ chest, onTap }: { chest: WeeklyChestView; onTap: () => void }) {
  const t = useTranslations("weeklyChest");
  const ready = chest.state === "READY";

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${chestTitle(chest, t)}, ${chestMeta(chest, t)}`}
      data-testid="today-path-chest"
      data-state={chest.state}
      className={[
        "relative grid cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2",
        ready
          ? "wc-hop size-16 bg-[var(--color-streak-core)] shadow-[0_4px_0_color-mix(in_srgb,var(--color-star)_60%,var(--color-main)_20%),0_0_0_8px_color-mix(in_srgb,var(--color-streak-core)_32%,transparent)]"
          : chest.state === "OPENED"
            ? "size-12 bg-[color-mix(in_srgb,var(--color-streak-core)_55%,var(--color-surface))] shadow-[0_4px_0_color-mix(in_srgb,var(--color-star)_60%,var(--color-main)_15%)] sm:size-14"
            : "size-12 bg-[color-mix(in_srgb,var(--color-streak-core)_30%,var(--color-surface))] shadow-[0_4px_0_color-mix(in_srgb,var(--color-star)_55%,var(--color-surface))] sm:size-14",
      ].join(" ")}
    >
      {ready ? (
        <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-card)] border-2 border-[var(--color-streak-core)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-black tracking-[0.02em] text-[color-mix(in_srgb,var(--color-star)_35%,var(--color-main))]">
          {t("ready_tag")}
        </span>
      ) : null}
      <ChestArt
        open={chest.state === "OPENED"}
        lamps={chestLamps(chest)}
        className={ready ? "w-14" : "w-10 sm:w-12"}
      />
    </button>
  );
}
