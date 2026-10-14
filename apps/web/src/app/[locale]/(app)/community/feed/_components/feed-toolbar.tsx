"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ListFilter } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ForumTagView } from "@mentor/types";
import { MenuSelect, type MenuSelectOption } from "@/components/menu-select";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import type { FeedContentFilter } from "./feed-content-filter";
import type { FeedTab } from "./feed-tab-selection";

const CHIP =
  "inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full border-[1.5px] px-3.5 text-sm font-extrabold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

type FeedFilterSheetHandle = { getValues: () => { tab: FeedTab; tag: string } };

/**
 * Akış controls: the ranking as a segment on desktop (a filter sheet on phones, with the tag), the
 * tag menu, then the content chips. The selected chip is the app's compact black, not a colour.
 */
export function FeedToolbar({
  tab,
  tag,
  tags,
  content,
  onTab,
  onTag,
  onContent,
}: {
  tab: FeedTab;
  tag: string;
  tags: ForumTagView[];
  content: FeedContentFilter;
  onTab: (tab: FeedTab) => void;
  onTag: (tag: string) => void;
  onContent: (content: FeedContentFilter) => void;
}) {
  const t = useTranslations("community");
  const { filterSheet } = useMentorBottomSheet();
  const sheetRef = useRef<FeedFilterSheetHandle>(null);
  const tabs = [
    { id: "featured", label: t("feed_sort_trending") },
    { id: "recent", label: t("feed_sort_recent") },
    { id: "top", label: t("feed_sort_top") },
    { id: "following", label: t("feed_scope_following") },
  ];
  const tagOptions: MenuSelectOption[] = [
    { value: "", label: t("feed_all_tags") },
    ...tags.map((entry) => ({ value: entry.slug, label: `#${entry.slug}` })),
  ];
  const contents: Array<{ id: FeedContentFilter; label: string }> = [
    { id: "all", label: t("feed_content_all") },
    { id: "posts", label: t("feed_content_posts") },
    { id: "questions", label: t("feed_content_questions") },
    { id: "waiting", label: t("feed_content_waiting") },
  ];
  const activeTabLabel = tabs.find((entry) => entry.id === tab)?.label ?? tabs[0]!.label;

  const openSheet = async () => {
    await filterSheet({
      title: t("feed_filters"),
      applyLabel: t("feed_apply_filters"),
      children: (
        <FeedFilterSheet
          ref={sheetRef}
          initialTab={tab}
          initialTag={tag}
          tabOptions={tabs.map(({ id, label }) => ({ value: id, label }))}
          tagOptions={tagOptions}
        />
      ),
      onApply: () => {
        const values = sheetRef.current?.getValues();
        if (!values) return;
        onTab(values.tab);
        onTag(values.tag);
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* The ranking gets the full width: beside the tag menu, "Takip ettiklerin" was cut at 1280. */}
      <div className="hidden sm:block">
        <SegmentPillControl
          items={tabs}
          value={tab}
          onChange={(value) => onTab(value as FeedTab)}
          ariaLabel={t("feed_sort_label")}
          idPrefix="community-feed-sort"
          equalWidth
        />
      </div>
      <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("feed_content_filter_label")}>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${t("feed_filters")}: ${tag ? `#${tag}` : activeTabLabel}`}
          onClick={() => void openSheet()}
          className={`${CHIP} gap-1.5 border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-main)] sm:hidden`}
        >
          <ListFilter size={16} aria-hidden />
          {tag ? `#${tag}` : activeTabLabel}
        </button>
        {contents.map((entry) => {
          const selected = entry.id === content;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onContent(entry.id)}
              className={`${CHIP} ${selected ? "border-[var(--color-main)] bg-[var(--color-main)] text-[var(--color-bg)]" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-body)] hover:border-[var(--play-line)]"}`}
            >
              {entry.label}
            </button>
          );
        })}
        <MenuSelect
          value={tag}
          onChange={onTag}
          aria-label={t("feed_filter_tag")}
          options={tagOptions}
          className="ml-auto hidden w-44 shrink-0 sm:block"
          textSize="sm"
        />
      </div>
    </div>
  );
}

const FeedFilterSheet = forwardRef<
  FeedFilterSheetHandle,
  {
    initialTag: string;
    initialTab: FeedTab;
    tabOptions: MenuSelectOption[];
    tagOptions: MenuSelectOption[];
  }
>(function FeedFilterSheet({ initialTab, initialTag, tabOptions, tagOptions }, ref) {
  const t = useTranslations("community");
  const [draftTab, setDraftTab] = useState<FeedTab>(initialTab);
  const [draftTag, setDraftTag] = useState(initialTag);

  useImperativeHandle(ref, () => ({ getValues: () => ({ tab: draftTab, tag: draftTag }) }));

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 text-sm font-bold text-[var(--color-main)]">
        {t("feed_sort_label")}
        <MenuSelect
          value={draftTab}
          onChange={(value) => setDraftTab(value as FeedTab)}
          options={tabOptions}
          aria-label={t("feed_sort_label")}
        />
      </div>
      <div className="grid gap-2 text-sm font-bold text-[var(--color-main)]">
        {t("feed_filter_tag")}
        <MenuSelect value={draftTag} onChange={setDraftTag} options={tagOptions} aria-label={t("feed_filter_tag")} />
      </div>
      {draftTab !== "featured" || draftTag ? (
        <button
          type="button"
          onClick={() => {
            setDraftTag("");
            setDraftTab("featured");
          }}
          className={`${PANEL_TEXT_LINK} justify-self-start`}
        >
          {t("feed_clear_filters")}
        </button>
      ) : null}
    </div>
  );
});
