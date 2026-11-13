import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { ApiClientError } from "@mentor/api-client";
import type { WeeklyRecapOfferDto, WeeklyReviewDto } from "@mentor/types";
import { RecapAccessCard } from "../../components/recap/recap-access-card.js";
import { recapOpenStep } from "../../components/recap/recap-flow.js";
import { RecapMessageState } from "../../components/recap/recap-message-state.js";
import { RecapStory } from "../../components/recap/recap-story.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import {
  fetchOwnedWeeklyRecap,
  fetchWeeklyRecapOffer,
  fetchWeeklyReview,
  openWeeklyRecap,
} from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { markRecapOpened } from "../../lib/recap-opened.js";
import { newRequestId } from "../../lib/request-id.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "offer"; offer: WeeklyRecapOfferDto }
  | { kind: "story"; review: WeeklyReviewDto; examId: string };

/**
 * The weekly story (the web's `WeeklyRecapEntry`, story only): the access card while the week is
 * locked, then the story. With the access flag off the week is free and goes straight to it.
 */
export default function WeeklyRecapScreen() {
  const { examId, weekStart } = useLocalSearchParams<{ examId?: string; weekStart?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const t = useTranslations("recap");
  const { palette } = useThemeTokens();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const message = useCallback(
    (cause: unknown) => (cause instanceof ApiClientError ? cause.message : t("load_error")),
    [t],
  );
  const exit = () => router.back();

  useEffect(() => {
    if (!examId) {
      setState({ kind: "error", message: t("load_error") });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    void (async () => {
      try {
        const offer = await fetchWeeklyRecapOffer(examId, weekStart);
        if (offer.enabled) {
          if (!cancelled) setState({ kind: "offer", offer });
          return;
        }
        const review = await fetchWeeklyReview(examId);
        if (!cancelled) setState({ kind: "story", review, examId });
      } catch (cause) {
        if (!cancelled) setState({ kind: "error", message: message(cause) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, weekStart, attempt, message, t]);

  // Coin earned elsewhere or a membership bought on the web: the offer catches up on return.
  const shown = state.kind === "offer" ? state.offer : null;
  const shownExam = shown?.examId;
  const shownWeek = shown?.weekStart;
  useEffect(() => {
    if (!shownExam || !shownWeek || busy) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      // ponytail: a failed background refetch keeps the shown offer; opening re-quotes on the server anyway.
      fetchWeeklyRecapOffer(shownExam, shownWeek)
        .then((offer) => setState((now) => (now.kind === "offer" ? { kind: "offer", offer } : now)))
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [shownExam, shownWeek, busy]);

  // The panel card turns into "watch again" once a READY story has loaded.
  const storyStart =
    state.kind === "story" && state.review.recap.status === "READY"
      ? state.review.period.startDate
      : null;
  useEffect(() => {
    if (storyStart) markRecapOpened(storyStart);
  }, [storyStart]);

  const read = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const report = await fetchOwnedWeeklyRecap(id);
      setState({ kind: "story", review: report.review, examId: report.examId });
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    if (state.kind !== "offer" || busy) return;
    const { offer } = state;
    const step = recapOpenStep(offer, armed);
    if (step === "read" && offer.reportId) {
      await read(offer.reportId);
      return;
    }
    if (step === "confirm") {
      setArmed(true);
      return;
    }
    if (offer.mode === "NONE") return;
    setBusy(true);
    setError(null);
    try {
      const report = await openWeeklyRecap({
        examId: offer.examId,
        weekStart: offer.weekStart,
        source: offer.mode,
        expectedCost: offer.cost,
        clientRequestId: newRequestId(),
      });
      haptics.success();
      void queryClient.invalidateQueries({ queryKey: ["economy"] });
      setState({ kind: "story", review: report.review, examId: report.examId });
    } catch (cause) {
      setError(message(cause));
      try {
        setState({ kind: "offer", offer: await fetchWeeklyRecapOffer(offer.examId, offer.weekStart) });
      } catch (refreshError) {
        setState({ kind: "error", message: message(refreshError) });
      }
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  const reload = async () => {
    if (state.kind !== "offer") return;
    setBusy(true);
    setError(null);
    setArmed(false);
    try {
      setState({
        kind: "offer",
        offer: await fetchWeeklyRecapOffer(state.offer.examId, state.offer.weekStart),
      });
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === "error") {
    return (
      <RecapMessageState
        title={t("error_title")}
        message={state.message}
        actions={[{ label: t("error_retry"), onPress: () => setAttempt((value) => value + 1) }]}
        onExit={exit}
      />
    );
  }

  if (state.kind === "story") {
    if (state.review.recap.status !== "READY") {
      return (
        <RecapMessageState
          title={t("empty_title")}
          message={state.review.recap.closingMessage}
          actions={[
            { label: t("empty_plan"), onPress: () => router.replace("/plan" as never) },
            {
              label: t("empty_start_session"),
              variant: "secondary",
              onPress: () => router.replace("/(app)/study-session" as never),
            },
          ]}
          onExit={exit}
        />
      );
    }
    return <RecapStory review={state.review} examId={state.examId} onExit={exit} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={exit}
          hitSlop={8}
          style={[styles.close, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.main} strokeWidth={2.25} strokeLinecap="round">
            <Path d="M18 6 6 18M6 6l12 12" />
          </Svg>
        </Pressable>
      </View>
      {state.kind === "loading" ? (
        <View accessible accessibilityLabel={t("loading")} style={styles.skeleton}>
          <Skeleton height={520} />
          <Skeleton height={128} />
        </View>
      ) : (
        <RecapAccessCard
          offer={state.offer}
          busy={busy}
          armed={armed}
          error={error}
          onOpen={() => void open()}
          onCancel={() => setArmed(false)}
          onRetry={() => void reload()}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bar: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    gap: 16,
  },
});
