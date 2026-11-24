import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { CloseCircleIcon } from "@solar-icons/react-native/linear/close-circle";
import { MagnifierIcon } from "@solar-icons/react-native/linear/magnifier";
import { useQuery } from "@tanstack/react-query";
import { CommunityAvatar } from "../../components/community/community-avatar.js";
import { PanelCard } from "../../components/panel/primitives.js";
import {
  AppText,
  Chip,
  ScreenLoadingSkeleton,
  StateView,
} from "../../components/ui/index.js";
import { fontFamilyFor } from "../../lib/fonts.js";
import { searchForum } from "../../lib/forum-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function CommunitySearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { palette, radii, space, typeScale } = useThemeTokens();
  const t = useTranslations("community");

  const [queryText, setQueryText] = useState("");
  const trimmed = queryText.trim();

  const searchQuery = useQuery({
    queryKey: ["forum", "search", trimmed],
    queryFn: () => searchForum(trimmed),
    enabled: trimmed.length >= 2,
  });

  const data = searchQuery.data;
  const hasResults = Boolean(
    data &&
      (data.questions.length > 0 ||
        data.threads.length > 0 ||
        data.zones.length > 0 ||
        data.people.length > 0 ||
        data.tags.length > 0),
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.topChrome,
          {
            paddingTop: insets.top,
            backgroundColor: palette.surface,
            borderBottomColor: palette.playLine,
          },
        ]}
      >
        <View style={styles.navBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back_cta")}
            onPress={() => router.back()}
            style={styles.iconBtn}
          >
            <AltArrowLeftIcon size={22} color={palette.main} strokeWidth={1.75} />
          </Pressable>
          <AppText accessibilityRole="header" style={styles.navTitle} numberOfLines={1}>
            {t("search_title")}
          </AppText>
          <View style={styles.spacer} />
        </View>

        <View style={styles.searchBarWrap}>
          <View
            style={[
              styles.searchField,
              {
                backgroundColor: palette.surfaceAlt,
                borderColor: palette.border,
                borderRadius: radii.inner,
              },
            ]}
          >
            <MagnifierIcon size={18} color={palette.muted} strokeWidth={1.75} />
            <TextInput
              autoFocus
              accessibilityLabel={t("search_placeholder")}
              placeholder={t("search_placeholder")}
              placeholderTextColor={palette.muted}
              value={queryText}
              onChangeText={setQueryText}
              returnKeyType="search"
              style={[
                styles.input,
                {
                  color: palette.main,
                  fontSize: typeScale.body.fontSize,
                  fontFamily: fontFamilyFor(typeScale.body.fontWeight),
                },
              ]}
            />
            {queryText.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("feed_clear_filters")}
                onPress={() => setQueryText("")}
                style={styles.clearBtn}
              >
                <CloseCircleIcon size={18} color={palette.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: space.md,
          paddingBottom: insets.bottom + 24,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {trimmed.length < 2 ? (
          <StateView title={t("search_title")} body={t("search_min_characters")} />
        ) : searchQuery.isLoading ? (
          <ScreenLoadingSkeleton />
        ) : searchQuery.isError ? (
          <StateView
            tone="error"
            title={t("error_title")}
            body={searchQuery.error instanceof ApiClientError ? searchQuery.error.message : t("search_empty_hint")}
            actionLabel={t("retry")}
            onAction={() => void searchQuery.refetch()}
          />
        ) : !hasResults ? (
          <StateView title={t("search_empty_title")} body={t("search_empty_hint")} />
        ) : (
          <>
            {data!.questions.length > 0 ? (
              <PanelCard style={styles.section}>
                <AppText variant="micro" tone="muted">{t("search_questions")}</AppText>
                {data!.questions.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/community-thread",
                        params: { id: item.id, kind: "question" },
                      })
                    }
                    style={[styles.resultRow, { borderColor: palette.playLine }]}
                  >
                    <AppText style={styles.rowTitle}>{item.title ?? item.bodyExcerpt}</AppText>
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {`${item.zoneTitle} · ${t("status_answers", { count: item.commentCount })}`}
                    </AppText>
                  </Pressable>
                ))}
              </PanelCard>
            ) : null}

            {data!.threads.length > 0 ? (
              <PanelCard style={styles.section}>
                <AppText variant="micro" tone="muted">{t("search_threads")}</AppText>
                {data!.threads.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/community-thread",
                        params: { id: item.id, kind: item.zoneType === "QA" ? "question" : "thread" },
                      })
                    }
                    style={[styles.resultRow, { borderColor: palette.playLine }]}
                  >
                    <AppText numberOfLines={2} style={styles.rowTitle}>
                      {item.title ?? item.bodyExcerpt}
                    </AppText>
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {item.zoneTitle}
                    </AppText>
                  </Pressable>
                ))}
              </PanelCard>
            ) : null}

            {data!.zones.length > 0 ? (
              <PanelCard style={styles.section}>
                <AppText variant="micro" tone="muted">{t("search_zones")}</AppText>
                {data!.zones.map((zone) => (
                  <Pressable
                    key={zone.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.replace({
                        pathname: "/(app)/(tabs)/community",
                        params: { tab: "forum", zoneSlug: zone.slug },
                      })
                    }
                    style={[styles.resultRow, { borderColor: palette.playLine }]}
                  >
                    <AppText style={styles.rowTitle}>{zone.title}</AppText>
                    {zone.description ? (
                      <AppText variant="caption" tone="secondary" numberOfLines={2}>
                        {zone.description}
                      </AppText>
                    ) : null}
                  </Pressable>
                ))}
              </PanelCard>
            ) : null}

            {data!.people.length > 0 ? (
              <PanelCard style={styles.section}>
                <AppText variant="micro" tone="muted">{t("search_people")}</AppText>
                {data!.people.map((person) => (
                  <Pressable
                    key={person.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/community-member",
                        params: { username: person.username },
                      })
                    }
                    style={[styles.personRow, { borderColor: palette.playLine }]}
                  >
                    <CommunityAvatar name={person.displayName} avatarUrl={person.avatarUrl} size={34} />
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.rowTitle}>{person.displayName}</AppText>
                      <AppText variant="caption" tone="muted">{`@${person.username}`}</AppText>
                    </View>
                  </Pressable>
                ))}
              </PanelCard>
            ) : null}

            {data!.tags.length > 0 ? (
              <PanelCard style={styles.section}>
                <AppText variant="micro" tone="muted">{t("search_tags")}</AppText>
                <View style={styles.chipsWrap}>
                  {data!.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      label={`#${tag.name}`}
                      onPress={() =>
                        router.replace({
                          pathname: "/(app)/(tabs)/community",
                          params: { tab: "feed", tag: tag.slug },
                        })
                      }
                    />
                  ))}
                </View>
              </PanelCard>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topChrome: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  navBar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "800", textAlign: "center" },
  spacer: { width: 44 },
  searchBarWrap: { paddingHorizontal: 16 },
  searchField: {
    minHeight: 46,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, paddingVertical: 8 },
  clearBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  section: { gap: 8 },
  resultRow: {
    minHeight: 44,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  personRow: {
    minHeight: 48,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
