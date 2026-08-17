"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type { ZoneView } from "@mentor/types";
import { Button, TextField } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { postThread } from "@/lib/forum";
import { ForumImagePicker } from "../../_components/forum-image-picker";
import { useForumImagePicker } from "../../_components/use-forum-image-picker";
import { useMentionAutocomplete } from "../../_components/use-mention-autocomplete";
import { MentionSuggestions } from "../../_components/mention-suggestions";
import { EmojiPickerButton } from "../../_components/EmojiPickerButton";
import { AudienceSelector } from "../../_components/audience-selector";

/** Ask a question in a QA zone (title + body + images) → navigate to the new question detail. */
export function AskComposer({ zone }: { zone: ZoneView }) {
  const t = useTranslations("community");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionAutocomplete(zone.id, bodyRef, setBody);
  const picker = useForumImagePicker();

  const submit = async () => {
    if (title.trim().length < 5 || !body.trim()) return;
    setBusy(true);
    picker.setError(null);
    try {
      const attachments = await picker.uploadAll();
      const created = await postThread(zone.id, body.trim(), title.trim(), attachments);
      router.push({
        pathname: "/community/question/[threadId]",
        params: { threadId: created.id },
      });
    } catch (err) {
      picker.setError(err instanceof ApiClientError ? err.body.message : t("error"));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <AudienceSelector zones={[zone]} value={zone.id} locked />
      <TextField
        label={t("ask_title_placeholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
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
          rows={4}
          maxLength={4000}
          className="w-full resize-y rounded-[10px] border border-[var(--color-border)] bg-[var(--color-soft)] p-3 text-base outline-none placeholder:text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
          {...mention.inputProps}
        />
        <MentionSuggestions mention={mention} />
      </div>
      <div className="flex items-center justify-between">
        <EmojiPickerButton
          textareaRef={bodyRef}
          value={body}
          onValueChange={setBody}
          disabled={busy}
        />
        <span className="text-xs text-[var(--color-secondary)]">{body.length}/4000</span>
      </div>
      <ForumImagePicker picker={picker} disabled={busy} />
      <FormError message={picker.error} />
      <div className="flex justify-end">
        <Button busy={busy} onClick={() => void submit()}>
          {t("ask_submit")}
        </Button>
      </div>
    </div>
  );
}
