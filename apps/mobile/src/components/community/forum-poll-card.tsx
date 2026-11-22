import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import type { ForumPollView } from "@mentor/types";
import { CheckCircleIcon } from "@solar-icons/react-native/bold/check-circle";
import { votePoll } from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

function formatPollEndDate(iso: string, locale: "tr" | "en"): string {
  try {
    return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
      timeZone: "Europe/Istanbul",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function ForumPollCard({
  poll,
  onUpdated,
}: {
  poll: ForumPollView;
  onUpdated: (next: ForumPollView) => void;
}) {
  const { locale } = useLocale();
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("community");
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const sortedOptions = useMemo(
    () => [...poll.options].sort((a, b) => a.position - b.position),
    [poll.options],
  );

  const isOpen = poll.status === "ACTIVE";
  const interactive = isOpen && poll.canVote;

  async function handleVote(optionId: string) {
    if (!interactive || votingOptionId) return;
    haptics.selection();
    setVotingOptionId(optionId);
    setErrorText(null);
    try {
      const next = await votePoll(poll.id, optionId);
      onUpdated(next);
    } catch (err) {
      setErrorText(err instanceof ApiClientError ? err.message : t("poll_vote_error"));
    } finally {
      setVotingOptionId(null);
    }
  }

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: palette.surfaceAlt,
          borderColor: palette.border,
          borderRadius: radii.inner,
        },
      ]}
    >
      <AppText variant="micro" tone="muted">
        {t("poll_title")}
      </AppText>

      <View style={styles.options}>
        {sortedOptions.map((option) => {
          const isSelected = poll.myOptionId === option.id;
          const pct = Math.max(0, Math.min(100, option.percentage ?? 0));
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: !interactive }}
              disabled={!interactive || votingOptionId !== null}
              onPress={() => void handleVote(option.id)}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  borderRadius: radii.inner,
                  borderColor: isSelected ? palette.ctaPlayEdge : palette.border,
                  backgroundColor: pressed ? palette.surfaceHover : palette.surface,
                },
              ]}
            >
              {poll.resultsVisible && pct > 0 ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.fillBar,
                    {
                      width: `${pct}%`,
                      backgroundColor: isSelected ? palette.playSelected : palette.playTrack,
                    },
                  ]}
                />
              ) : null}
              <View style={styles.optionContent}>
                <View style={styles.optionLeft}>
                  {isSelected ? (
                    <CheckCircleIcon size={18} color={palette.playSelectedInk} />
                  ) : null}
                  <AppText
                    style={[
                      styles.optionText,
                      {
                        color: isSelected ? palette.playSelectedInk : palette.main,
                        fontWeight: isSelected ? "800" : "600",
                      },
                    ]}
                  >
                    {option.text}
                  </AppText>
                </View>
                {poll.resultsVisible && option.percentage !== null ? (
                  <AppText
                    variant="caption"
                    tabularNums
                    style={{
                      color: isSelected ? palette.playSelectedInk : palette.secondary,
                      fontWeight: "700",
                    }}
                  >
                    {`${Math.round(pct)}%`}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {errorText ? (
        <AppText variant="caption" tone="danger">
          {errorText}
        </AppText>
      ) : null}

      <View style={styles.footer}>
        <AppText variant="caption" tone="muted" tabularNums>
          {t("poll_votes", { count: poll.totalVoteCount })}
        </AppText>
        <AppText variant="caption" tone="muted">
          {isOpen
            ? t("poll_ends_at", { date: formatPollEndDate(poll.endsAt, locale) })
            : t("poll_closed")}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  options: {
    gap: 8,
  },
  optionRow: {
    minHeight: 44,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  fillBar: {
    ...StyleSheet.absoluteFill,
    right: undefined,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  optionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
