"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type { ZoneView } from "@mentor/types";
import { Button } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { PANEL_CARD } from "@/components/panel/panel-styles";
import { postThread } from "@/lib/forum";
import { AttachmentPreviewStrip } from "../../_components/attachment-preview-strip";
import { COMMUNITY_FIELD } from "../../_components/community-row";
import { ComposerAttachButton } from "../../_components/composer-attach-button";
import { useForumImagePicker } from "../../_components/use-forum-image-picker";
import { useMentionAutocomplete } from "../../_components/use-mention-autocomplete";
import { MentionSuggestions } from "../../_components/mention-suggestions";
import { EmojiPickerButton } from "../../_components/EmojiPickerButton";

/**
 * Ask a question in a QA room (title + body + files) → the new question's page. One tool row under
 * the body: emoji and attach on the left, the count and the room's ledge on the right.
 */
export function AskComposer({ zone }: { zone: ZoneView }) {
  const t = useTranslations("community");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionAutocomplete(zone.id, bodyRef, setBody);
  const picker = useForumImagePicker();
  const { items, removeAt, addFiles, fileRef, atLimit, uploadAll, setError, error } = picker;
  const ready = title.trim().length >= 5 && Boolean(body.trim());

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const attachments = await uploadAll();
      const created = await postThread(zone.id, body.trim(), title.trim(), attachments);
      router.push({ pathname: "/community/question/[threadId]", params: { threadId: created.id } });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("error"));
      setBusy(false);
    }
  };

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-label={t("ask_submit")}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder={t("ask_title_placeholder")}
        aria-label={t("ask_title_placeholder")}
        className={`${COMMUNITY_FIELD} font-extrabold`}
      />
      <div className="relative">
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onSelect={mention.sync}
          onBlur={mention.close}
          onKeyDown={(e) => void mention.onKeyDown(e)}
          placeholder={t("ask_body_placeholder")}
          aria-label={t("ask_body_placeholder")}
          rows={4}
          maxLength={4000}
          className={`${COMMUNITY_FIELD} resize-y py-3`}
          {...mention.inputProps}
        />
        <MentionSuggestions mention={mention} />
      </div>
      <AttachmentPreviewStrip items={items} onRemove={removeAt} />
      <FormError message={error} />
      <div className="flex items-center gap-1">
        <EmojiPickerButton textareaRef={bodyRef} value={body} onValueChange={setBody} disabled={busy} />
        <ComposerAttachButton fileRef={fileRef} addFiles={addFiles} atLimit={atLimit} disabled={busy} />
        <span className="ml-auto mr-3 text-caption font-semibold tabular-nums text-[var(--color-secondary)]">
          {body.length}/4000
        </span>
        <Button size="sm" busy={busy} disabled={!ready} onClick={() => void submit()}>
          {t("ask_submit")}
        </Button>
      </div>
    </section>
  );
}
