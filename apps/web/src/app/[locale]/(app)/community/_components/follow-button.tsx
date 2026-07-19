"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { followUser, unfollowUser } from "@/lib/follow";

/**
 * Shared optimistic follow/unfollow button (suggestions + follower/following lists). Toggles its own
 * label instantly, reverts on failure. `onChange` lets the parent react (e.g. refetch the Akış feed).
 */
export function FollowButton({
  username,
  initialFollowing,
  onChange,
}: {
  username: string;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
}) {
  const t = useTranslations("community");
  const [following, setFollowing] = useState(initialFollowing);

  const toggle = () => {
    const next = !following;
    setFollowing(next);
    onChange?.(next);
    (next ? followUser(username) : unfollowUser(username)).catch(() => {
      setFollowing(!next);
      onChange?.(!next);
    });
  };

  return (
    <Button variant={following ? "secondary" : "primary"} onClick={toggle}>
      {following ? t("following_state") : t("follow")}
    </Button>
  );
}
