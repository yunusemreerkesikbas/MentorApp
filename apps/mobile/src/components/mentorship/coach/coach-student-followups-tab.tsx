import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import { shiftDate, todayIso } from "@mentor/core";
import type { MentorshipFollowupDto, Paginated } from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { haptics } from "../../../lib/haptics.js";
import {
  createFollowup,
  fetchFollowupAvailability,
  fetchMentorshipFollowups,
  updateFollowup,
} from "../../../lib/mentorship-followups-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { newRequestId } from "../../../lib/request-id.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { FormSheet, PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, Chip, Skeleton, StateView, TextField } from "../../ui/index.js";

const PAGE_SIZE = 10;

export function CoachStudentFollowupsTab({ studentId }: { studentId: string }) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const toast = useToast();
  const { palette, radii, space } = useThemeTokens();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<MentorshipFollowupDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replacesId, setReplacesId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [sharedDecision, setSharedDecision] = useState("");
  const [followUpDate, setFollowUpDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const opRef = useRef<{ sig: string; id: string } | null>(null);

  const today = todayIso();

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const avail = await fetchFollowupAvailability();
      if (!avail.enabled) {
        setEnabled(false);
        return;
      }
      setEnabled(true);
      const res = await fetchMentorshipFollowups({
        studentId,
        view: "ALL",
        page,
        pageSize: PAGE_SIZE,
      });
      setData(res);
    } catch (err) {
      if (err instanceof ApiClientError && err.body.code === "MENTORSHIP_FOLLOWUP_DISABLED") {
        setEnabled(false);
        return;
      }
      setEnabled(true);
      setErrorMsg(extractMentorshipError(err, tCommon("error_body")));
    } finally {
      setLoading(false);
    }
  }, [studentId, page, tCommon]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  function openCompose(nextReplacesId: string | null) {
    setReplacesId(nextReplacesId);
    setTitle("");
    setPrivateNote("");
    setSharedDecision("");
    setFollowUpDate(shiftDate(today, 7));
    opRef.current = null;
    setComposeOpen(true);
  }

  async function handleCreate() {
    if (!title.trim() || busy) return;
    const draft = {
      title: title.trim(),
      privateNote: privateNote.trim() || null,
      sharedDecision: sharedDecision.trim() || null,
      followUpDate: followUpDate?.trim() ? followUpDate.trim() : null,
      replacesId,
    };
    const sig = JSON.stringify(draft);
    if (opRef.current?.sig !== sig) {
      opRef.current = { sig, id: newRequestId() };
    }
    setBusy(true);
    try {
      await createFollowup(studentId, { ...draft, operationId: opRef.current.id });
      void haptics.success();
      setComposeOpen(false);
      setPage(1);
      setTick((n) => n + 1);
    } catch (err) {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    } finally {
      setBusy(false);
    }
  }

  async function handleMutate(
    item: MentorshipFollowupDto,
    patch: { status?: "COMPLETED" | "CANCELLED"; followUpDate?: string | null },
  ) {
    setBusy(true);
    try {
      await updateFollowup(studentId, item.id, { version: item.version, ...patch });
      void haptics.success();
      setTick((n) => n + 1);
    } catch (err) {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    } finally {
      setBusy(false);
    }
  }

  if (enabled === false) {
    return (
      <StateView
        title={t("followup_disabled_title")}
        body={t("followup_disabled_body")}
        tone="empty"
      />
    );
  }

  const items = data?.items ?? [];

  return (
    <View style={{ gap: space.md }}>
      <PanelCard style={{ gap: space.sm }}>
        <View style={styles.headerRow}>
          <PanelCardTitle>{t("followup_recent_title")}</PanelCardTitle>
          <Button label={t("followup_new")} onPress={() => openCompose(null)} />
        </View>
        <AppText variant="caption" tone="secondary">
          {t("followup_history_body")}
        </AppText>
      </PanelCard>

      {loading && data === null ? (
        <Skeleton height={140} />
      ) : errorMsg ? (
        <StateView
          title={tCommon("error_title")}
          body={errorMsg}
          actionLabel={tCommon("retry")}
          onAction={() => setTick((n) => n + 1)}
          tone="error"
        />
      ) : items.length === 0 ? (
        <StateView
          title={t("followup_history_empty")}
          body={t("followup_rail_empty")}
          tone="empty"
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {items.map((item) => (
            <PanelCard key={`${item.id}-${item.version}`} style={{ gap: space.sm }}>
              <AppText variant="sectionHeading">{item.title}</AppText>
              <View style={styles.tagRow}>
                <Chip
                  label={t(`followup_status_${item.status}` as "followup_status_OPEN")}
                  tone={item.status === "OPEN" ? "coach" : "default"}
                />
                {item.sharedDecision !== null ? (
                  <Chip
                    label={t(`followup_response_${item.response}` as "followup_response_PENDING")}
                    tone={
                      item.response === "ACCEPTED"
                        ? "success"
                        : item.response === "CHANGE_REQUESTED"
                          ? "warning"
                          : "default"
                    }
                  />
                ) : null}
                {item.followUpDate ? (
                  <Chip
                    label={formatDisplayDate(`${item.followUpDate}T12:00:00.000Z`, locale)}
                  />
                ) : null}
              </View>

              {item.privateNote ? (
                <View
                  style={[
                    styles.noteBlock,
                    { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner },
                  ]}
                >
                  <AppText variant="micro" tone="secondary">
                    {t("followup_private_hint")}
                  </AppText>
                  <AppText variant="body">{item.privateNote}</AppText>
                </View>
              ) : null}

              {item.sharedDecision ? (
                <View
                  style={[
                    styles.noteBlock,
                    { backgroundColor: palette.playSelected, borderRadius: radii.inner },
                  ]}
                >
                  <AppText variant="micro" style={{ color: palette.playSelectedInk }}>
                    {t("followup_shared_hint")}
                  </AppText>
                  <AppText variant="body">{item.sharedDecision}</AppText>
                </View>
              ) : null}

              {item.status === "OPEN" ? (
                <View style={styles.tagRow}>
                  <Button
                    label={t("followup_complete")}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void handleMutate(item, { status: "COMPLETED" })}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t("followup_cancel")}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void handleMutate(item, { status: "CANCELLED" })}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : (
                <Button
                  label={t("followup_replace")}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => openCompose(item.id)}
                />
              )}
            </PanelCard>
          ))}
        </View>
      )}

      {data && data.total > PAGE_SIZE ? (
        <View style={styles.tagRow}>
          <Button
            label={t("pager_prev")}
            variant="secondary"
            disabled={page <= 1 || loading}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={{ flex: 1 }}
          />
          <Button
            label={t("pager_next")}
            variant="secondary"
            disabled={page * PAGE_SIZE >= data.total || loading}
            onPress={() => setPage((p) => p + 1)}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      <FormSheet
        visible={composeOpen}
        title={t("followup_create")}
        closeLabel={tCommon("close")}
        closeDisabled={busy}
        onClose={() => setComposeOpen(false)}
      >
        {replacesId ? (
          <AppText variant="caption" tone="secondary">
            {t("followup_replacement_hint")}
          </AppText>
        ) : null}
        <TextField
          label={t("followup_title_label")}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />
        <TextField
          label={t("followup_private_label")}
          hint={t("followup_private_hint")}
          value={privateNote}
          onChangeText={setPrivateNote}
          maxLength={2000}
          multiline
          style={{ minHeight: 84, paddingTop: 10, textAlignVertical: "top" }}
        />
        <TextField
          label={t("followup_shared_label")}
          hint={t("followup_shared_hint")}
          value={sharedDecision}
          onChangeText={setSharedDecision}
          maxLength={2000}
          multiline
          style={{ minHeight: 84, paddingTop: 10, textAlignVertical: "top" }}
        />
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">
            {t("followup_date_label")}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
            <Chip
              label={t("followup_date_none")}
              selected={followUpDate === null}
              onPress={() => setFollowUpDate(null)}
            />
            {[3, 7, 14].map((offset) => {
              const iso = shiftDate(today, offset);
              return (
                <Chip
                  key={offset}
                  label={formatDisplayDate(`${iso}T12:00:00.000Z`, locale)}
                  selected={followUpDate === iso}
                  onPress={() => setFollowUpDate(iso)}
                />
              );
            })}
          </ScrollView>
        </View>
        <Button
          label={sharedDecision.trim() ? t("followup_save_share") : t("followup_save_private")}
          disabled={!title.trim()}
          loading={busy}
          onPress={() => void handleCreate()}
        />
      </FormSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  noteBlock: {
    padding: 12,
    gap: 4,
  },
});
