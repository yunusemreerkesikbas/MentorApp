"use client";

import { useTranslations } from "next-intl";
import { PostDetailSkeleton } from "./post-skeleton";

export function PostDetailLoading() {
  const t = useTranslations("community");
  return <PostDetailSkeleton label={t("loading")} />;
}
