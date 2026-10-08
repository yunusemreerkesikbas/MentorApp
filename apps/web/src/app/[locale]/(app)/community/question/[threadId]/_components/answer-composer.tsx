"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ForumCoachIntent } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { FormError } from "@/components/form";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { trackCoachEvent, trackCommunityEvent } from "@/lib/analytics";
import { communityReturnPlaceholderKey } from "@/lib/community-coach-bridge";
import { postAnswer } from "@/lib/forum";
import { AttachmentPreviewStrip } from "../../../_components/attachment-preview-strip";
import { COMMUNITY_FIELD } from "../../../_components/community-row";
import { ComposerAttachButton } from "../../../_components/composer-attach-button";
import { useForumImagePicker } from "../../../_components/use-forum-image-picker";
import { useMentionAutocomplete } from "../../../_components/use-mention-autocomplete";
import { MentionSuggestions } from "../../../_components/mention-suggestions";
import { EmojiPickerButton } from "../../../_components/EmojiPickerButton";

/**
 * "Sen de el uzat!" under the answers: one field, one tool row (emoji, attach, count, "Cevapla").
 * Kept apart from the chat ThreadComposer on purpose, to avoid cross-route coupling. A coach
 * return (`returnIntent`) focuses it and scrolls it into view.
 */
export function AnswerComposer({
  threadId,
  zoneId,
  onPosted,
  returnIntent,
}: {
  threadId: string;
  zoneId: string;
  onPosted: () => void;
  returnIntent: ForumCoachIntent | null;
}) {
  const t = useTranslations("community");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionAutocomplete(zoneId, textareaRef, setValue);
  const { items, removeAt, addFiles, fileRef, atLimit, uploadAll, reset, setError, error } =
    useForumImagePicker();

  useEffect(() => {
    if (!returnIntent) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    textarea.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [returnIntent]);

  const send = async () => {
    const body = value.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const attachments = await uploadAll();
      await postAnswer(threadId, body, attachments);
      trackCommunityEvent("forum_reply_created", { target: "thread", zone_type: "QA" });
      if (returnIntent) {
        trackCoachEvent("coach_community_return_reply_created", {
          intent: returnIntent,
          zone_type: "QA",
        });
      }
      setValue("");
      reset();
      onPosted();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-labelledby="answer-compose-title">
      <h2 id="answer-compose-title" className={PANEL_CARD_TITLE}>
        {t("answer_compose_title")}
      </h2>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onSelect={mention.sync}
          onBlur={mention.close}
          onKeyDown={(e) => void mention.onKeyDown(e)}
          placeholder={
            returnIntent ? t(communityReturnPlaceholderKey(returnIntent)) : t("answer_placeholder")
          }
          aria-labelledby="answer-compose-title"
          rows={4}
          maxLength={4000}
          className={`${COMMUNITY_FIELD} min-h-[120px] resize-y py-3`}
          {...mention.inputProps}
        />
        <MentionSuggestions mention={mention} />
      </div>
      <AttachmentPreviewStrip items={items} onRemove={removeAt} />
      <FormError message={error} />
      <div className="flex items-center gap-1">
        <EmojiPickerButton textareaRef={textareaRef} value={value} onValueChange={setValue} disabled={busy} />
        <ComposerAttachButton fileRef={fileRef} addFiles={addFiles} atLimit={atLimit} disabled={busy} />
        <span className="ml-auto mr-3 text-caption font-semibold tabular-nums text-[var(--color-secondary)]">
          {value.length}/4000
        </span>
        <Button size="sm" busy={busy} disabled={!value.trim()} onClick={() => void send()}>
          {t("answer_submit")}
        </Button>
      </div>
    </section>
  );
}
