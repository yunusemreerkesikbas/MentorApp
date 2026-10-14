"use client";

import { useOptimistic, useTransition } from "react";
import { SlidingTabs } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import type { blogHref } from "@/lib/blog-href";

export interface BlogTab {
  id: string;
  label: string;
  href: ReturnType<typeof blogHref>;
}

/**
 * A blog filter as `SlidingTabs`: the pill moves on the tap (optimistic), the list follows when the
 * server answers. The URL stays the filter's source (`?family=&category=`), so a reload or a shared
 * link opens the same view; crawlers reach the family hubs through the sitemap.
 */
export function BlogTabs({
  tabs,
  value,
  ariaLabel,
  variant,
}: {
  tabs: BlogTab[];
  value: string;
  ariaLabel: string;
  variant: "pill" | "underline";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(value);

  function handleChange(id: string) {
    const tab = tabs.find((candidate) => candidate.id === id);
    if (!tab || id === selected) return;
    startTransition(() => {
      setSelected(id);
      router.push(tab.href, { scroll: false });
    });
  }

  return (
    <SlidingTabs
      items={tabs}
      value={selected}
      onChange={handleChange}
      ariaLabel={ariaLabel}
      variant={variant}
      // Arrow keys move focus by id; the two filters on the hub need distinct ones.
      idPrefix={`blog-${variant}`}
      // The underline bar is drawer chrome by default (20 px inset); here it lines up with the page.
      style={variant === "underline" ? { paddingInline: 0 } : undefined}
    />
  );
}
