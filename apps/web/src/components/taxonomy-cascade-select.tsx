"use client";

import { useId } from "react";
import type { ExamSubjectDto, ExamTopicDto } from "@mentor/types";
import { MenuSelect, type MenuSelectTextSize } from "@/components/menu-select";

export type TaxonomyValueMode = "slug" | "name";

export interface TaxonomyCascadeSelectProps {
  subjects: ExamSubjectDto[];
  topics: ExamTopicDto[];
  subjectValue: string;
  topicValue: string;
  onSubjectChange: (next: string) => void;
  onTopicChange: (next: string) => void;
  subjectLabel: string;
  emptySubjectLabel: string;
  topicLabel?: string;
  emptyTopicLabel?: string;
  valueMode?: TaxonomyValueMode;
  showTopic?: boolean;
  hideTopicWhenEmpty?: boolean;
  disabled?: boolean;
  menuSide?: "top" | "bottom";
  textSize?: MenuSelectTextSize;
  layout?: "stack" | "grid";
  labelClassName?: string;
  subjectLabelId?: string;
  topicLabelId?: string;
}

function subjectKey(subject: ExamSubjectDto, mode: TaxonomyValueMode): string {
  return mode === "name" ? subject.name : subject.slug;
}

function topicKey(
  topic: ExamTopicDto,
  mode: TaxonomyValueMode,
): string {
  return mode === "name" ? topic.name : topic.slug;
}

function topicsForSubject(
  topics: ExamTopicDto[],
  subjectValue: string,
  mode: TaxonomyValueMode,
): ExamTopicDto[] {
  if (!subjectValue) return [];
  if (mode === "name") {
    return topics.filter((topic) => topic.subjectName === subjectValue);
  }
  return topics.filter((topic) => topic.subjectSlug === subjectValue);
}

/**
 * Shared ders → konu cascade. Notebooks persist slugs; plan/coach persist display names.
 */
export function TaxonomyCascadeSelect({
  subjects,
  topics,
  subjectValue,
  topicValue,
  onSubjectChange,
  onTopicChange,
  subjectLabel,
  emptySubjectLabel,
  topicLabel,
  emptyTopicLabel,
  valueMode = "slug",
  showTopic = true,
  hideTopicWhenEmpty = true,
  disabled,
  menuSide,
  textSize = "base",
  layout = "stack",
  labelClassName = "text-sm font-semibold",
  subjectLabelId,
  topicLabelId,
}: TaxonomyCascadeSelectProps) {
  const reactId = useId();
  const subjectId = subjectLabelId ?? `taxonomy-subject-${reactId}`;
  const topicId = topicLabelId ?? `taxonomy-topic-${reactId}`;
  const mode = valueMode;
  const subjectTopics = topicsForSubject(topics, subjectValue, mode);
  const showTopicField =
    showTopic && (!hideTopicWhenEmpty || subjectTopics.length > 0);

  const subjectField = (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        id={subjectId}
        className={labelClassName}
        style={{ color: "var(--color-main)" }}
      >
        {subjectLabel}
      </span>
      <MenuSelect
        value={subjectValue}
        disabled={disabled || subjects.length === 0}
        textSize={textSize}
        menuSide={menuSide}
        aria-labelledby={subjectId}
        options={[
          { value: "", label: emptySubjectLabel },
          ...subjects.map((subject) => ({
            value: subjectKey(subject, mode),
            label: subject.name,
          })),
        ]}
        onChange={(next) => {
          onSubjectChange(next);
          onTopicChange("");
        }}
      />
    </div>
  );

  const topicField =
    showTopicField && topicLabel && emptyTopicLabel ? (
      <div className="flex min-w-0 flex-col gap-1">
        <span
          id={topicId}
          className={labelClassName}
          style={{ color: "var(--color-main)" }}
        >
          {topicLabel}
        </span>
        <MenuSelect
          value={topicValue}
          disabled={disabled || subjectValue === "" || subjectTopics.length === 0}
          textSize={textSize}
          menuSide={menuSide}
          aria-labelledby={topicId}
          options={[
            { value: "", label: emptyTopicLabel },
            ...subjectTopics.map((topic) => ({
              value: topicKey(topic, mode),
              label: topic.name,
            })),
          ]}
          onChange={onTopicChange}
        />
      </div>
    ) : null;

  if (layout === "grid") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {subjectField}
        {topicField}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {subjectField}
      {topicField}
    </div>
  );
}
