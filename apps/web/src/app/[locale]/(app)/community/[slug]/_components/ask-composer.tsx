"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextField } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { postThread } from "@/lib/forum";
import { ForumImagePicker } from "../../_components/forum-image-picker";
import { useForumImagePicker } from "../../_components/use-forum-image-picker";
import { useMentionAutocomplete } from "../../_components/use-mention-autocomplete";
import { MentionSuggestions } from "../../_components/mention-suggestions";

/** Ask a question in a QA zone (title + body + images) → navigate to the new question detail. */
export function AskComposer({ zoneId }: { zoneId: string }) {
  const t = useTranslations("community");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionAutocomplete(zoneId, bodyRef, setBody);
  const picker = useForumImagePicker();

  const submit = async () => {
    if (title.trim().length < 5 || !body.trim()) return;
    setBusy(true);
    picker.setError(null);
    try {
      const attachments = await picker.uploadAll();
      const created = await postThread(zoneId, body.trim(), title.trim(), attachments);
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
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#e2e5ea] bg-white p-5">
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
          className="w-full resize-y rounded-[10px] border border-[#dfe3e8] bg-[#fbfcfd] p-3 text-base outline-none placeholder:text-[#656c78] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
          {...mention.inputProps}
        />
        <MentionSuggestions mention={mention} />
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
