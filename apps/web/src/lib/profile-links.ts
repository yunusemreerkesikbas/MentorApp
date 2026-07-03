const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function optionalUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getProfileLinks() {
  return {
    shareUrl: siteUrl,
    feedbackUrl: optionalUrl(process.env.NEXT_PUBLIC_PROFILE_FEEDBACK_URL),
    social: [
      {
        id: "youtube",
        label: "YouTube",
        shortLabel: "YT",
        href: optionalUrl(process.env.NEXT_PUBLIC_MENTOR_YOUTUBE_URL),
      },
      {
        id: "tiktok",
        label: "TikTok",
        shortLabel: "TK",
        href: optionalUrl(process.env.NEXT_PUBLIC_MENTOR_TIKTOK_URL),
      },
      {
        id: "instagram",
        label: "Instagram",
        shortLabel: "IG",
        href: optionalUrl(process.env.NEXT_PUBLIC_MENTOR_INSTAGRAM_URL),
      },
      {
        id: "x",
        label: "X",
        shortLabel: "X",
        href: optionalUrl(process.env.NEXT_PUBLIC_MENTOR_X_URL),
      },
    ].filter((link): link is { id: string; label: string; shortLabel: string; href: string } =>
      Boolean(link.href),
    ),
  };
}
