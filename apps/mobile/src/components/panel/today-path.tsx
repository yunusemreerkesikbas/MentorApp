import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { CheckCircleIcon } from "@solar-icons/react-native/bold/check-circle";
import { NotebookIcon } from "@solar-icons/react-native/bold/notebook";
import { PlayIcon } from "@solar-icons/react-native/bold/play";
import { SquareAcademicCapIcon } from "@solar-icons/react-native/bold/square-academic-cap";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import type { PathNode, TodayPath as TodayPathModel } from "@mentor/core";
import type { WeeklyChestView } from "@mentor/types";
import { art } from "../../lib/art.js";
import { mixHex } from "../../lib/layout.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";

type PanelT = ReturnType<typeof useTranslations<"panel">>;

/** Stop width, node row height and connector line, from the web's `PathItem`. */
const ITEM_WIDTH = 76;
const NODE_ROW = 64;
const CONNECTOR_TOP = 30;
const NODE_SMALL = 48;
const NODE_CURRENT = 64;
/** Room above the path for the "Sıradaki" tag that sits over the current node. */
const TAG_ROOM = 36;

/**
 * The day as a path (the web's `TodayPath`): what is done, the next step (the only big node),
 * what follows, and the weekly chest at the end. A task node opens a small menu instead of acting
 * on the tap, so a thumb brushing the path never starts a session or ticks a task by accident.
 */
export function TodayPath({
  path,
  chest,
  busyTaskId,
  onNodePress,
  onChestPress,
  onAddTask,
  onOpenPlan,
}: {
  path: TodayPathModel;
  chest: WeeklyChestView | null;
  busyTaskId: string | null;
  onNodePress: (node: PathNode) => void;
  onChestPress: (chest: WeeklyChestView) => void;
  onAddTask: () => void;
  onOpenPlan: () => void;
}) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const stops: Stop[] = [];

  if (path.hiddenBefore > 0) {
    stops.push({
      key: "earlier",
      reached: true,
      title: t("path_earlier_done", { count: path.hiddenBefore }),
      node: (
        <Disc size={NODE_SMALL} fill={palette.ctaPlayBg} edge={palette.ctaPlayEdge}>
          <CheckCircleIcon size={20} color={palette.ctaPlayInk} />
        </Disc>
      ),
    });
  }

  if (path.total === 0) {
    stops.push({
      key: "first",
      reached: false,
      title: t("path_first_step"),
      meta: t("path_first_step_meta"),
      node: (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("cta_add_task")}
          onPress={onAddTask}
          style={[
            styles.dashed,
            {
              backgroundColor: palette.surface,
              borderColor: mixHex(palette.secondary, palette.surface, 0.45),
            },
          ]}
        >
          <AddIcon size={24} color={palette.secondary} strokeWidth={2.5} />
        </Pressable>
      ),
    });
  }

  for (const node of path.nodes) {
    const meta = nodeMeta(node, t);
    stops.push({
      key: node.task.id,
      reached: node.state !== "upcoming",
      title: node.task.title,
      meta,
      node: (
        <TaskNode
          node={node}
          meta={meta}
          busy={busyTaskId === node.task.id}
          onPress={() => onNodePress(node)}
        />
      ),
    });
  }

  if (path.hiddenAfter > 0) {
    stops.push({
      key: "more",
      reached: false,
      title: t("path_more"),
      node: (
        <Pressable accessibilityRole="button" accessibilityLabel={t("path_more")} onPress={onOpenPlan}>
          <Disc
            size={NODE_SMALL}
            fill={palette.playTrack}
            edge={mixHex(palette.main, palette.playTrack, 0.12)}
          >
            <AppText style={[styles.moreCount, { color: palette.secondary }]}>
              +{path.hiddenAfter}
            </AppText>
          </Disc>
        </Pressable>
      ),
    });
  }

  if (chest) {
    stops.push({
      key: "chest",
      reached: path.cta.kind === "DAY_COMPLETE" || chest.state !== "PROGRESS",
      title: chestTitle(chest, t),
      meta: chestMeta(chest, t),
      node: <ChestNode chest={chest} onPress={() => onChestPress(chest)} />,
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.content}
    >
      {stops.map((stop, index) => {
        const next = stops[index + 1];
        return (
          <View key={stop.key} style={styles.item}>
            {/* The line to the next stop is drawn here, so that stop's node paints over its end. */}
            {next ? (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: next.reached ? palette.ctaPlayBg : palette.playTrack },
                ]}
              />
            ) : null}
            <View style={styles.nodeRow}>{stop.node}</View>
            <AppText numberOfLines={2} style={styles.itemTitle}>
              {stop.title}
            </AppText>
            {stop.meta ? (
              <AppText numberOfLines={1} style={[styles.itemMeta, { color: palette.secondary }]}>
                {stop.meta}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

interface Stop {
  key: string;
  /** Whether the line leading to this stop is filled. */
  reached: boolean;
  title: string;
  meta?: string;
  node: ReactNode;
}

function TaskNode({
  node,
  meta,
  busy,
  onPress,
}: {
  node: PathNode;
  meta: string;
  busy: boolean;
  onPress: () => void;
}) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const { state } = node;
  const current = state === "current";
  const reached = state !== "upcoming";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[node.task.title, state === "done" ? t("node_done") : meta]
        .filter(Boolean)
        .join(", ")}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={busy ? styles.busy : undefined}
    >
      {current ? (
        <View pointerEvents="none" style={styles.tagBox}>
          <View
            style={[styles.tag, { backgroundColor: palette.surface, borderColor: palette.playLine }]}
          >
            <AppText numberOfLines={1} style={[styles.tagText, { color: palette.playSelectedInk }]}>
              {t("node_next")}
            </AppText>
          </View>
        </View>
      ) : null}
      <Disc
        size={current ? NODE_CURRENT : NODE_SMALL}
        fill={reached ? palette.ctaPlayBg : palette.playTrack}
        edge={reached ? palette.ctaPlayEdge : mixHex(palette.main, palette.playTrack, 0.12)}
        ring={current ? palette.playSelected : undefined}
        edgeDepth={current ? 5 : 4}
      >
        {state === "done" ? (
          <CheckCircleIcon size={24} color={palette.ctaPlayInk} />
        ) : current ? (
          <PlayIcon size={28} color={palette.ctaPlayInk} />
        ) : (
          <NotebookIcon size={24} color={palette.secondary} />
        )}
      </Disc>
      {node.fromCoach ? (
        <View
          style={[
            styles.coachMark,
            { backgroundColor: palette.coachAccent, borderColor: palette.surface },
          ]}
        >
          <SquareAcademicCapIcon size={12} color={palette.bg} />
        </View>
      ) : null}
    </Pressable>
  );
}

function ChestNode({ chest, onPress }: { chest: WeeklyChestView; onPress: () => void }) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const ready = chest.state === "READY";
  const opened = chest.state === "OPENED";
  const gold = palette.streakCore;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chestTitle(chest, t)}, ${chestMeta(chest, t)}`}
      onPress={onPress}
    >
      {ready ? (
        <View pointerEvents="none" style={styles.tagBox}>
          <View style={[styles.tag, { backgroundColor: palette.surface, borderColor: gold }]}>
            <AppText
              numberOfLines={1}
              style={[styles.tagText, { color: mixHex(palette.star, palette.main, 0.35) }]}
            >
              {t("chest_ready_tag")}
            </AppText>
          </View>
        </View>
      ) : null}
      <Disc
        size={ready ? NODE_CURRENT : NODE_SMALL}
        fill={ready ? gold : mixHex(gold, palette.surface, opened ? 0.55 : 0.3)}
        edge={mixHex(palette.star, palette.surface, ready ? 0.75 : 0.55)}
        ring={ready ? mixHex(gold, palette.surface, 0.32) : undefined}
      >
        <Image
          source={opened ? art.chestOpen : art.chestClosed}
          style={ready ? styles.chestArtReady : styles.chestArt}
          contentFit="contain"
        />
      </Disc>
    </Pressable>
  );
}

/**
 * A path node: a round face on a solid edge (the web's `0 4px 0` shadow), with an optional soft
 * ring for the stop that is next.
 */
function Disc({
  size,
  fill,
  edge,
  ring,
  edgeDepth = 4,
  children,
}: {
  size: number;
  fill: string;
  edge: string;
  ring?: string;
  edgeDepth?: number;
  children: ReactNode;
}) {
  const radius = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      {ring ? (
        <View
          style={[
            styles.ring,
            {
              width: size + 16,
              height: size + 16,
              borderRadius: radius + 8,
              backgroundColor: ring,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.discEdge,
          { top: edgeDepth, width: size, height: size, borderRadius: radius, backgroundColor: edge },
        ]}
      />
      <View
        style={[
          styles.discFace,
          { width: size, height: size, borderRadius: radius, backgroundColor: fill },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function nodeMeta(node: PathNode, t: PanelT): string {
  const { task, state } = node;
  return [
    state === "done"
      ? t("node_done")
      : node.minutes === null
        ? t("node_stopwatch")
        : t("node_minutes", { minutes: node.minutes }),
    task.subject && task.subject !== task.title ? task.subject : null,
    node.fromCoach ? t("node_from_coach") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function chestReward(chest: WeeklyChestView, t: PanelT): string | null {
  if (!chest.reward) return null;
  return chest.reward.unit === "XP"
    ? t("chest_reward_xp", { amount: chest.reward.amount })
    : t("chest_reward_coin", { amount: chest.reward.amount });
}

function chestTitle(chest: WeeklyChestView, t: PanelT): string {
  if (chest.state !== "READY") return t("chest_title");
  return chest.carriedOver ? t("chest_carried_title") : t("chest_ready_title");
}

function chestMeta(chest: WeeklyChestView, t: PanelT): string {
  const reward = chestReward(chest, t);
  if (chest.state === "READY") return t("chest_ready_meta");
  if (chest.state === "OPENED") {
    return reward ? t("chest_opened_meta_reward", { reward }) : t("chest_opened_meta");
  }
  const progress = { current: Math.min(chest.current, chest.target), target: chest.target };
  return reward
    ? t("chest_progress_meta_reward", { ...progress, reward })
    : t("chest_progress_meta", progress);
}

const styles = StyleSheet.create({
  // Bleeds to the card's edges so the path scrolls under them, like the web's `-mx-5 px-5`.
  scroller: {
    marginHorizontal: -20,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: TAG_ROOM,
    paddingBottom: 4,
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  connector: {
    position: "absolute",
    left: ITEM_WIDTH / 2,
    top: CONNECTOR_TOP,
    width: ITEM_WIDTH,
    height: 4,
    borderRadius: 2,
  },
  nodeRow: {
    height: NODE_ROW,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    width: "100%",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },
  itemMeta: {
    width: "100%",
    marginTop: -4,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  busy: {
    opacity: 0.6,
  },
  // Wider than the node it labels, so the tag can size to its text and stay centred.
  tagBox: {
    position: "absolute",
    top: -TAG_ROOM,
    left: -40,
    right: -40,
    alignItems: "center",
    zIndex: 1,
  },
  tag: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  coachMark: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dashed: {
    width: NODE_SMALL,
    height: NODE_SMALL,
    borderRadius: NODE_SMALL / 2,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  moreCount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  ring: {
    position: "absolute",
    left: -8,
    top: -8,
  },
  discEdge: {
    position: "absolute",
    left: 0,
  },
  discFace: {
    alignItems: "center",
    justifyContent: "center",
  },
  chestArt: {
    width: 40,
    height: 40,
  },
  chestArtReady: {
    width: 56,
    height: 56,
  },
});
