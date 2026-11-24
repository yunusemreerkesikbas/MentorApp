import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { NOTEBOOK_ERROR_TYPES, type ExamSubjectDto, type NotebookEntryDto, type NotebookErrorType } from "@mentor/types";
import {
  createNotebookEntry, fetchNotebookEntries, fetchNotebookEntry, reviewNotebookEntry, type MistakeScope,
} from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { newRequestId } from "../../lib/request-id.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { FormSheet, PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { AppText, Button, Chip, Skeleton, TextField } from "../ui/index.js";
import { NotebookFan } from "../notebooks/notebook-fan.js";
import { NotebookLightbox } from "../notebooks/notebook-canvas.js";
import { useAuth } from "../../providers/auth-provider.js";
import { AnalysisLink } from "./analysis-link.js";

export type NotebookSheetState = {
  scope: MistakeScope;
  reviewing: boolean;
  entryId?: string;
  focusReview?: boolean;
};

export function MistakeNotebookView({ examId, addExamId, subjects, initial, onClose, onRefresh }: {
  examId?: string;
  addExamId?: string;
  subjects: ExamSubjectDto[];
  initial: NotebookSheetState;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { mediaImageSource } = useAuth();
  const t = useTranslations("analysis");
  const tMistakes = useTranslations("analysisMistakes");
  const tHistory = useTranslations("analysisHistory");
  const tReview = useTranslations("analysisReview");
  const tCommon = useTranslations("common");
  const { space } = useThemeTokens();
  const [reviewing, setReviewing] = useState(initial.reviewing);
  const [early, setEarly] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(initial.entryId ?? null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const request = useRef<{ id: string; solved: boolean; reviewId: string } | null>(null);

  const entries = useInfiniteQuery({
    queryKey: ["notebook", "entries", examId, initial.scope, reviewing, early],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchNotebookEntries(examId, { ...initial.scope, status: initial.scope.status ?? (reviewing ? "ACTIVE" : undefined) },
      pageParam, reviewing && !early && !initial.scope.revisit),
    getNextPageParam: ({ page, pageSize, total }) => page * pageSize < total ? page + 1 : undefined,
    enabled: !selected && !adding,
  });
  const details = useQuery({
    queryKey: ["notebook", "detail", selected],
    queryFn: () => fetchNotebookEntry(selected!),
    enabled: Boolean(selected),
  });
  const allItems = entries.data?.pages.flatMap((page) => page.items) ?? [];
  const items = reviewing ? allItems.filter(item => !completed.includes(item.id)) : allItems;
  const review = useMutation({
    mutationFn: ({ id, solved, reviewId }: NonNullable<typeof request.current>) => reviewNotebookEntry(id, solved, reviewId),
    onSuccess: async entry => {
      setCompleted(old => [...old, entry.id]);
      haptics.success();
      request.current = null;
      await onRefresh();
      setRevealed(null);
      setFocus(null);
      if (selected) setReviewing(false);
    },
  });

  const active = selected ? details.data : reviewing ? items.find(e => e.id === focus) : null;
  const shownTitle = reviewing ? tMistakes("cta_review")
    : selected ? tReview("entry_title") : adding ? t("add_mistake_title") : tMistakes("open_notebook");
  const showIndex = () => { setSelected(null); setReviewing(false); setAdding(false); setFocus(null); };
  const answer = (entry: NotebookEntryDto, solved: boolean) => {
    if (review.isPending) return;
    if (request.current?.id !== entry.id || request.current?.solved !== solved) {
      request.current = { id: entry.id, solved, reviewId: newRequestId() };
    }
    review.mutate(request.current);
  };
  const state = selected ? details : entries;

  return (
    <FormSheet visible title={shownTitle} closeLabel={tCommon("close")} onClose={onClose} closeDisabled={review.isPending}>
      {adding && addExamId ? (
        <NotebookAddForm examId={addExamId} subjects={subjects} scope={initial.scope}
          onBack={showIndex} onSaved={async () => { await onRefresh(); showIndex(); }} />
      ) : state.isPending ? <Skeleton height={84} /> : state.isError ? (
        <>
          <AppText tone="secondary">{tCommon("error_body")}</AppText>
          <AnalysisLink label={tCommon("retry")} onPress={() => void state.refetch()} />
        </>
      ) : active ? (
        <>
          <NotebookEntryBody entry={active} openPhoto={setPhoto} />
          {active.solutionUrl || active.solutionNote ? revealed === active.id || !reviewing ? (
            <View style={{ gap: space.sm }}>
              {active.solutionUrl ? <Pressable accessibilityRole="imagebutton" accessibilityLabel={tReview("show_solution")} onPress={() => setPhoto(active.solutionUrl!)}><Image cachePolicy="none" source={mediaImageSource(active.solutionUrl)} contentFit="contain" style={{ height: 180 }} /></Pressable> : null}
              {active.solutionNote ? <AppText tone="secondary">{active.solutionNote}</AppText> : null}
            </View>
          ) : <AnalysisLink label={tReview("show_solution")} onPress={() => setRevealed(active.id)} /> : null}
          {reviewing && active.status === "ACTIVE" ? (
            <View style={{ gap: space.sm }}>
              <Button label={t("review_solved_cta")} disabled={review.isPending} onPress={() => answer(active, true)} />
              <Button label={t("review_unsolved_cta")} variant="secondary" disabled={review.isPending} onPress={() => answer(active, false)} />
              {review.isError ? <AppText tone="danger">{review.error instanceof Error ? review.error.message : tCommon("error_body")}</AppText> : null}
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              {active.status === "ACTIVE" ? <Button label={tMistakes("cta_review")} onPress={() => setReviewing(true)} /> : null}
              <AnalysisLink label={tReview("back_index")} onPress={showIndex} />
            </View>
          )}
        </>
      ) : reviewing && items.length ? (
        <NotebookFan entries={items} open={setFocus} />
      ) : reviewing ? (
        <>
          <AppText tone="secondary">{t("due_empty")}</AppText>
          {entries.hasNextPage && <Button label={tHistory("load_more")} loading={entries.isFetchingNextPage} onPress={() => void entries.fetchNextPage()} />}
          {initial.focusReview && !early && !initial.scope.revisit && <Button label={tReview("early")} onPress={() => setEarly(true)} />}
          <AnalysisLink label={tMistakes("open_notebook")} onPress={showIndex} />
        </>
      ) : (
        <>
          <Button label={t("add_mistake_title")} disabled={!addExamId} onPress={() => setAdding(true)} />
          {!items.length ? <AppText tone="secondary">{tReview("index_empty")}</AppText> : null}
          {items.map((entry) => (
            <PanelCard key={entry.id}>
              <AnalysisLink label={[entry.subjectName, entry.topicName].filter(Boolean).join(" · ") || t(`error_${entry.errorType}`)}
                onPress={() => setSelected(entry.id)} />
              {entry.note ? <AppText variant="caption" tone="secondary" numberOfLines={2}>{entry.note}</AppText> : null}
              <AppText variant="micro" tone="muted">{t(`status_${entry.status}`)}</AppText>
            </PanelCard>
          ))}
          {entries.hasNextPage && !entries.isFetchingNextPage ? (
            <AnalysisLink label={tHistory("load_more")} onPress={() => void entries.fetchNextPage()} />
          ) : null}
        </>
      )}
      {photo && <NotebookLightbox uri={photo} close={() => setPhoto(null)} />}
    </FormSheet>
  );
}

function NotebookEntryBody({ entry, openPhoto }: { entry: NotebookEntryDto; openPhoto: (uri: string) => void }) {
  const { mediaImageSource } = useAuth();
  const t = useTranslations("analysis");
  const { space } = useThemeTokens();
  return (
    <PanelCard style={{ gap: space.sm }}>
      <PanelCardTitle>{[entry.subjectName, entry.topicName].filter(Boolean).join(" · ") || t("mistake_subject_label")}</PanelCardTitle>
      <AppText variant="caption" tone="secondary">{t(`error_${entry.errorType}`)}</AppText>
      {entry.url ? <Pressable accessibilityRole="imagebutton" accessibilityLabel={t("mistake_subject_label")} onPress={() => openPhoto(entry.url!)}><Image cachePolicy="none" source={mediaImageSource(entry.url)} contentFit="contain" style={{ height: 220 }} /></Pressable> : null}
      {entry.note ? <AppText>{entry.note}</AppText> : null}
    </PanelCard>
  );
}

function NotebookAddForm({ examId, subjects, scope, onBack, onSaved }: {
  examId: string;
  subjects: ExamSubjectDto[];
  scope: MistakeScope;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {

  const t = useTranslations("analysis");
  const tReview = useTranslations("analysisReview");
  const tCommon = useTranslations("common");
  const { space } = useThemeTokens();
  const [subject, setSubject] = useState(scope.subjectRef ?? subjects[0]?.slug ?? null);
  const [reason, setReason] = useState<NotebookErrorType>(scope.errorType ?? "UNKNOWN_TOPIC");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => createNotebookEntry({
      examId, mockExamId: scope.mockExamId, source: "OWN", subjectRef: subject,
      topicRef: subject === scope.subjectRef ? scope.topicRef : undefined,
      errorType: reason, note: note.trim() || null,
    }),
    onSuccess: async () => { haptics.success(); await onSaved(); },
  });

  return (
    <View style={{ gap: space.md }}>
      <AppText variant="caption" tone="secondary">{t("mistake_subject_label")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {subjects.map((item) => (
          <Chip label={item.name} key={item.slug} selected={subject === item.slug} onPress={() => setSubject(item.slug)} />
        ))}
      </View>
      <AppText variant="caption" tone="secondary">{t("mistake_error_type_label")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {NOTEBOOK_ERROR_TYPES.map((key) => (
          <Chip label={t(`error_${key}`)} key={key} selected={reason === key} onPress={() => setReason(key)} />
        ))}
      </View>
      <TextField label={t("mistake_note_label")} placeholder={t("mistake_note_placeholder")} value={note} onChangeText={setNote} />
      {save.isError ? <AppText tone="danger">{save.error instanceof Error ? save.error.message : tCommon("error_body")}</AppText> : null}
      <Button label={t("save_mistake_cta")} loading={save.isPending} onPress={() => { if (!save.isPending) save.mutate(); }} />
      <AnalysisLink label={tReview("back_index")} onPress={onBack} />
    </View>
  );
}
