import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText } from "../ui/text.js";
import { PlanEventRow } from "./plan-event-row.js";
import { PlanTaskRow } from "./plan-task-row.js";

/** "Görevler": the day's coach meetings, then its tasks (the web's `PlanListView` card). */
export function PlanTaskCard({
  readOnly,
  tasks,
  events,
  viewerId,
  busyId,
  onAdd,
  onToggle,
  onOpenMenu,
  onStartSession,
  onOpenEvent,
}: {
  readOnly: boolean;
  tasks: PlanTaskDto[];
  events: PlanEventDto[];
  viewerId: string | null;
  busyId: string | null;
  onAdd: () => void;
  onToggle: (task: PlanTaskDto) => void;
  onOpenMenu: (task: PlanTaskDto) => void;
  onStartSession: (task: PlanTaskDto) => void;
  onOpenEvent: (event: PlanEventDto) => void;
}) {
  const { palette } = useThemeTokens();
  const t = useTranslations("plan");
  const empty = tasks.length === 0 && events.length === 0;

  return (
    <PanelCard>
      <View style={styles.heading}>
        <AppText accessibilityRole="header" style={styles.headingText}>
          {t("tasks_title")}
        </AppText>
        {!readOnly ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("add_task")}
            onPress={onAdd}
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          >
            <AddIcon size={26} color={palette.main} />
          </Pressable>
        ) : null}
      </View>

      {empty ? (
        <AppText tone="secondary" style={styles.empty}>
          {t("empty_desc")}
        </AppText>
      ) : (
        <View style={styles.list}>
          {events.map((event) => (
            <PlanEventRow
              key={event.id}
              event={event}
              viewerId={viewerId}
              onPress={() => onOpenEvent(event)}
            />
          ))}
          {tasks.map((task, index) => (
            <Fragment key={task.id}>
              {index > 0 ? (
                <View style={[styles.hairline, { backgroundColor: palette.playLine }]} />
              ) : null}
              <PlanTaskRow
                task={task}
                readOnly={readOnly}
                busy={busyId === task.id}
                onToggle={() => onToggle(task)}
                onOpenMenu={() => onOpenMenu(task)}
                onStartSession={() => onStartSession(task)}
              />
            </Fragment>
          ))}
        </View>
      )}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headingText: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
  },
  add: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  list: {
    marginTop: 8,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 24,
  },
});
