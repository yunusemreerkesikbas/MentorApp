import { useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { AltArrowDownIcon } from "@solar-icons/react-native/linear/alt-arrow-down";
import { CheckReadIcon } from "@solar-icons/react-native/linear/check-read";
import { VerifiedCheckIcon } from "@solar-icons/react-native/linear/verified-check";
import { flattenPlanAdaptationChanges, selectedPlanAdaptationChanges, type PlanAdaptationRow } from "@mentor/core";
import type { ApplyPlanAdaptationResultDto, CoachPlanAdaptationDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { applyCoachPlanAdaptation } from "../../../lib/coach-api.js";
import { createDismissQueue, groupRowsByDate } from "../../../lib/plan-puhu.js";
import { errorText } from "../../../lib/plan-view.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { CompanionBubble } from "../../panel/companion-bubble.js";
import { FormSheet } from "../../panel/primitives.js";
import { Button } from "../../ui/index.js";
import { AppText } from "../../ui/text.js";

const tag = (locale: string) => (locale === "en" ? "en-GB" : "tr-TR");

/**
 * Puhu's plan draft (the web's `PlanCoachAdaptationPreview` in its sheet): every change ticked at
 * first, the student unticks what they do not want, then applies the rest in one write.
 */
export function PlanPuhuPreview({
  preview,
  input,
  visible,
  onApplied,
  onPlanChanged,
  onRegenerate,
  onClose,
  onDismiss,
}: {
  preview: CoachPlanAdaptationDto;
  input: CoachPlanAdaptationInput;
  visible: boolean;
  onApplied: (result: ApplyPlanAdaptationResultDto) => Promise<void>;
  /** The plan moved under the draft (409): refresh what the screen shows. */
  onPlanChanged: () => Promise<void>;
  /** Ask Puhu again with the same answers, once this sheet has closed. */
  onRegenerate: (input: CoachPlanAdaptationInput) => void;
  onClose: () => void;
  /** iOS: the sheet has finished closing. */
  onDismiss?: () => void;
}) {
  const t = useTranslations("plan");
  const tEvidence = useTranslations("planEvidence");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const { palette, radii } = useThemeTokens();
  const toast = useToast();
  const rows = useMemo(() => flattenPlanAdaptationChanges(preview.changes), [preview.changes]);
  const days = useMemo(() => groupRowsByDate(rows), [rows]);
  const [selected, setSelected] = useState(() => new Set(rows.map((row) => row.key)));
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openEvidence, setOpenEvidence] = useState(false);
  const writing = useRef(false);
  const [dismiss] = useState(() => createDismissQueue(Platform.OS));

  // A new draft starts fully ticked, with no error left from the last one.
  const [shownFor, setShownFor] = useState(preview);
  if (shownFor !== preview) {
    setShownFor(preview);
    setSelected(new Set(rows.map((row) => row.key)));
    setError(null);
    setStale(false);
    setOpenEvidence(false);
  }

  const formatDate = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(tag(locale), { weekday: "long", day: "numeric", month: "long" });
  const evidenceLabel = (type: string) => {
    const text = tEvidence(type as "OTHER");
    return text === type ? tEvidence("OTHER") : text;
  };
  const evidence = preview.usedEvidence ?? [];

  const toggle = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (error && !stale) setError(null);
  };

  const regenerate = () => {
    onClose();
    dismiss.queue(() => onRegenerate(input));
  };

  const apply = async () => {
    if (preview.status === "NO_CHANGE") {
      onClose();
      return;
    }
    if (writing.current) return;
    const changes = selectedPlanAdaptationChanges(rows, selected);
    if (changes.length === 0) {
      setError(t("coach_adaptation_select_required"));
      setStale(false);
      return;
    }
    writing.current = true;
    setBusy(true);
    setError(null);
    let result: ApplyPlanAdaptationResultDto;
    try {
      result = await applyCoachPlanAdaptation({ planRevision: preview.planRevision, source: input.source, changes });
    } catch (failure) {
      const conflict =
        failure instanceof Error &&
        failure.name === "ApiClientError" &&
        (failure as Error & { status?: number }).status === 409;
      if (conflict) await onPlanChanged().catch(() => undefined);
      setError(errorText(failure, tCommon("error_body")));
      setStale(conflict);
      return;
    } finally {
      writing.current = false;
      setBusy(false);
    }
    onClose();
    await onApplied(result);
    toast.show(
      `${t("coach_adaptation_success_title")}. ${t("coach_adaptation_success_message", {
        moveCount: result.moved.length,
        addCount: result.added.length,
      })}`,
    );
  };

  return (
    <FormSheet
      visible={visible}
      title={t("coach_adaptation_preview_title")}
      closeLabel={t("coach_adaptation_close")}
      closeDisabled={busy}
      onClose={onClose}
      onDismiss={() => {
        dismiss.flush();
        onDismiss?.();
      }}
      footer={
        <Button
          label={preview.status === "READY" ? t("coach_adaptation_apply_selected") : t("coach_adaptation_close")}
          loading={busy}
          onPress={() => void apply()}
        />
      }
    >
      <View style={styles.stack}>
        {preview.coachNote || preview.groundingLine ? (
          <CompanionBubble text={preview.coachNote ?? preview.groundingLine!} />
        ) : null}
        {preview.coachNote && preview.groundingLine ? (
          <AppText variant="caption" tone="secondary">
            {preview.groundingLine}
          </AppText>
        ) : null}
        <AppText variant="body" tone="secondary">
          {preview.message}
        </AppText>

        {evidence.length > 0 ? (
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: openEvidence }}
              onPress={() => setOpenEvidence((open) => !open)}
              style={styles.evidenceHead}
            >
              <VerifiedCheckIcon size={16} color={palette.accent} />
              <AppText variant="caption" numberOfLines={1} style={[styles.evidenceTitle, { color: palette.main }]}>
                {t("coach_adaptation_evidence_title")}
              </AppText>
              <View style={openEvidence ? styles.chevronOpen : undefined}>
                <AltArrowDownIcon size={16} color={palette.secondary} />
              </View>
            </Pressable>
            {openEvidence ? (
              <View style={styles.evidenceList}>
                {evidence.map((item, index) => (
                  <AppText key={index} variant="caption" tone="secondary">
                    <AppText variant="caption" style={styles.bold}>
                      {evidenceLabel(item.type)}:
                    </AppText>{" "}
                    {item.summary}
                  </AppText>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <AppText accessibilityRole="alert" variant="caption" tone="danger" style={styles.bold}>
            {error}
          </AppText>
        ) : null}
        {stale ? (
          <Button
            label={t("coach_adaptation_regenerate")}
            variant="secondary"
            onPress={regenerate}
          />
        ) : null}

        {days.map(([date, dayRows]) => (
          <View key={date} style={styles.day}>
            <AppText accessibilityRole="header" style={[styles.dayTitle, { color: palette.main }]}>
              {formatDate(date)}
            </AppText>
            {dayRows.map((row) => (
              <ChangeCard
                key={row.key}
                row={row}
                checked={selected.has(row.key)}
                formatDate={formatDate}
                onToggle={() => toggle(row.key)}
                radius={radii.card}
              />
            ))}
          </View>
        ))}

        {rows.length > 0 ? (
          <AppText accessibilityLiveRegion="polite" variant="caption" tone="secondary" style={styles.bold}>
            {t("coach_adaptation_selected_count", { count: selected.size })}
          </AppText>
        ) : null}
      </View>
    </FormSheet>
  );
}

/** One change with its box; the card's edge follows the box, so a skipped change reads at a glance. */
function ChangeCard({
  row,
  checked,
  formatDate,
  onToggle,
  radius,
}: {
  row: PlanAdaptationRow;
  checked: boolean;
  formatDate: (date: string) => string;
  onToggle: () => void;
  radius: number;
}) {
  const t = useTranslations("plan");
  const { palette } = useThemeTokens();
  const { change } = row;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={[
        styles.card,
        { borderRadius: radius, borderColor: checked ? palette.ctaPlayBg : palette.playLine, backgroundColor: palette.surface },
      ]}
    >
      {/* Remounted when it fills: Android keeps a rounded view square if its fill changes in place. */}
      <View
        key={checked ? "on" : "off"}
        style={[
          styles.box,
          checked
            ? { backgroundColor: palette.ctaPlayBg, borderColor: palette.ctaPlayBg }
            : { borderColor: palette.secondary },
        ]}
      >
        {checked ? <CheckReadIcon size={14} color={palette.ctaPlayInk} /> : null}
      </View>
      <View style={styles.cardText}>
        <AppText variant="body" style={[styles.semibold, { color: palette.main }]}>
          {change.title}
        </AppText>
        {change.kind === "ADD" && change.durationMinutes != null ? (
          <AppText variant="caption" tone="secondary" style={styles.semibold}>
            {t("duration_minutes", { minutes: change.durationMinutes })}
          </AppText>
        ) : null}
        {change.kind === "MOVE" ? (
          <AppText variant="caption" tone="secondary">
            {t("coach_adaptation_move_dates", { from: formatDate(change.fromDate), to: formatDate(change.toDate) })}
          </AppText>
        ) : null}
        {change.subject ? (
          <AppText variant="caption" tone="secondary">
            {change.subject}
          </AppText>
        ) : null}
        {change.reason ? (
          <AppText variant="caption" tone="secondary" style={styles.medium}>
            {t("coach_adaptation_reason", { reason: change.reason })}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  bold: {
    fontWeight: "700",
  },
  semibold: {
    fontWeight: "600",
  },
  medium: {
    fontWeight: "500",
  },
  evidenceHead: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  evidenceTitle: {
    flex: 1,
    fontWeight: "700",
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  evidenceList: {
    gap: 6,
    paddingLeft: 24,
    paddingBottom: 4,
  },
  day: {
    gap: 8,
  },
  dayTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  card: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  box: {
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
