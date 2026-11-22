import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { CoachCohortBriefCard } from "../../../components/mentorship/coach/coach-cohort-brief-card.js";
import { CoachFollowupInboxCard } from "../../../components/mentorship/coach/coach-followup-inbox-card.js";
import { CoachInviteSeatsCard } from "../../../components/mentorship/coach/coach-invite-seats-card.js";
import {
  CoachRosterList,
  type RosterFilterTab,
} from "../../../components/mentorship/coach/coach-roster-list.js";
import { AppText, Skeleton, StateView } from "../../../components/ui/index.js";
import { tabBarClearance } from "../../../lib/layout.js";
import {
  fetchCoachRegistrationState,
  fetchCohortBrief,
  fetchMentorshipOverview,
  fetchRoster,
} from "../../../lib/mentorship-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function CoachStudentsScreen() {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  const [tab, setTab] = useState<RosterFilterTab>("ACTIVE");
  const [inboxTick, setInboxTick] = useState(0);

  const overviewQuery = useQuery({
    queryKey: ["mentorship-overview"],
    queryFn: fetchMentorshipOverview,
  });

  const regStateQuery = useQuery({
    queryKey: ["mentorship-registration-state"],
    queryFn: fetchCoachRegistrationState,
  });

  const activeQuery = useQuery({
    queryKey: ["mentorship-roster", "ACTIVE"],
    queryFn: () => fetchRoster("ACTIVE"),
  });

  const endedQuery = useQuery({
    queryKey: ["mentorship-roster", "ENDED"],
    queryFn: () => fetchRoster("ENDED"),
    enabled: tab === "ENDED",
  });

  const cohortBriefQuery = useQuery({
    queryKey: ["mentorship-cohort-brief"],
    queryFn: fetchCohortBrief,
  });

  const isLoading = overviewQuery.isLoading && activeQuery.isLoading;
  const isRefreshing =
    overviewQuery.isRefetching ||
    activeQuery.isRefetching ||
    cohortBriefQuery.isRefetching;

  const handleRefresh = () => {
    setInboxTick((n) => n + 1);
    void Promise.all([
      overviewQuery.refetch(),
      regStateQuery.refetch(),
      activeQuery.refetch(),
      cohortBriefQuery.refetch(),
      ...(tab === "ENDED" ? [endedQuery.refetch()] : []),
    ]);
  };

  const activeRows = activeQuery.data ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: space.lg,
        paddingHorizontal: space.lg,
        paddingBottom: tabBarClearance(insets.bottom),
        gap: space.md,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={palette.coachAccent}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <AppText variant="caption" tone="coach">
          {t("badge")}
        </AppText>
        <AppText variant="title">{t("title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("subtitle")}
        </AppText>
      </View>

      {isLoading ? (
        <View style={{ gap: space.sm }}>
          <Skeleton height={120} />
          <Skeleton height={180} />
        </View>
      ) : activeQuery.isError ? (
        <StateView
          title={tCommon("error_title")}
          body={extractMentorshipError(activeQuery.error, tCommon("error_body"))}
          actionLabel={tCommon("retry")}
          onAction={() => void activeQuery.refetch()}
          tone="error"
        />
      ) : (
        <>
          <CoachInviteSeatsCard
            overview={overviewQuery.data ?? null}
            registrationState={regStateQuery.data ?? null}
          />
          <CoachFollowupInboxCard reloadSignal={inboxTick} />
          <CoachCohortBriefCard
            cohortBrief={cohortBriefQuery.data ?? null}
            hasActiveStudents={activeRows.length > 0}
          />
          <CoachRosterList
            tab={tab}
            onTabChange={setTab}
            activeRows={activeRows}
            endedRows={endedQuery.data ?? []}
            endedLoading={endedQuery.isLoading}
            endedError={endedQuery.isError}
            onRetryEnded={() => void endedQuery.refetch()}
          />
        </>
      )}
    </ScrollView>
  );
}
