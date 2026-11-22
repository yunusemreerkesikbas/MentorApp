import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@mentor/api-client";
import { MentorshipStackBar } from "../../components/mentorship/coach-identity-badges.js";
import { MyCoachEmptyCard } from "../../components/mentorship/student/my-coach-empty-card.js";
import { MyCoachFollowupsCard } from "../../components/mentorship/student/my-coach-followups-card.js";
import { MyCoachHeroCard } from "../../components/mentorship/student/my-coach-hero-card.js";
import { MyCoachNoteCard } from "../../components/mentorship/student/my-coach-note-card.js";
import { MyCoachSharedDataCard } from "../../components/mentorship/student/my-coach-shared-data-card.js";
import { MyCoachWeeklyReportsCard } from "../../components/mentorship/student/my-coach-weekly-reports-card.js";
import { Button, Skeleton, StateView } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { endMyCoachLink, fetchMyCoach, fetchSharedData } from "../../lib/mentorship-api.js";
import { extractMentorshipError } from "../../lib/mentorship-view.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";

export default function MyCoachScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const params = useLocalSearchParams<{ code?: string | string[]; welcome?: string }>();
  const initialCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const [justAccepted, setJustAccepted] = useState(params.welcome === "1");
  const [followupsTick, setFollowupsTick] = useState(0);

  const coachQuery = useQuery({
    queryKey: ["my-coach"],
    queryFn: async () => {
      try {
        return { off: false as const, coach: await fetchMyCoach() };
      } catch (err) {
        if (err instanceof ApiClientError && err.body.code === "MENTORSHIP_DISABLED") {
          return { off: true as const, coach: null };
        }
        throw err;
      }
    },
  });

  const sharedDataQuery = useQuery({
    queryKey: ["my-coach", "shared-data"],
    queryFn: () => fetchSharedData().catch(() => null),
  });

  const endLinkMutation = useMutation({
    mutationFn: endMyCoachLink,
    onSuccess: async () => {
      void haptics.success();
      setJustAccepted(false);
      await queryClient.invalidateQueries({ queryKey: ["my-coach"] });
      await queryClient.invalidateQueries({ queryKey: ["coach-registration-state"] });
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const onRefresh = () => {
    setFollowupsTick((n) => n + 1);
    void Promise.all([
      coachQuery.refetch(),
      sharedDataQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["my-coach", "weekly-reports"] }),
    ]);
  };

  const isLoading = coachQuery.isLoading;
  const coach = coachQuery.data?.coach ?? null;
  const off = coachQuery.data?.off ?? false;

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <MentorshipStackBar title={t("my_coach_title")} onBack={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.xl,
          gap: space.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={coachQuery.isRefetching || sharedDataQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={palette.coachAccent}
          />
        }
      >
        {isLoading ? (
          <View style={{ gap: space.md }}>
            <Skeleton height={180} />
            <Skeleton height={140} />
          </View>
        ) : coachQuery.isError ? (
          <StateView
            title={tCommon("error_title")}
            body={extractMentorshipError(coachQuery.error, tCommon("error_body"))}
            actionLabel={tCommon("retry")}
            onAction={() => void coachQuery.refetch()}
            tone="error"
          />
        ) : off || coach === null ? (
          <>
            <MyCoachEmptyCard
              off={off}
              initialCode={initialCode}
              onAccepted={async () => {
                setJustAccepted(true);
                setFollowupsTick((n) => n + 1);
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["my-coach"] }),
                  queryClient.invalidateQueries({ queryKey: ["my-coach", "shared-data"] }),
                ]);
              }}
            />
            {!off ? (
              <Button
                label={t("become_coach_cta")}
                variant="secondary"
                onPress={() => router.push("/(app)/coach-application" as never)}
              />
            ) : null}
          </>
        ) : (
          <>
            <MyCoachHeroCard coach={coach} welcome={justAccepted} />
            <MyCoachNoteCard
              key={coach.studentNote?.updatedAt ?? "empty"}
              note={coach.studentNote}
              onSaved={(studentNote) => {
                queryClient.setQueryData(["my-coach"], {
                  off: false as const,
                  coach: { ...coach, studentNote },
                });
              }}
            />
            <MyCoachFollowupsCard reloadSignal={followupsTick} />
            <MyCoachWeeklyReportsCard coachName={coach.coachDisplayName} />
            <MyCoachSharedDataCard
              scope={coach.dataScope}
              values={sharedDataQuery.data ?? null}
              busy={endLinkMutation.isPending}
              onEndLink={() => endLinkMutation.mutate()}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
});
