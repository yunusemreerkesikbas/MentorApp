"use client";
import { CircleHelp, Hash, MessageCircle } from "lucide-react";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ForumTagView, ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { trackCommunityEvent } from "@/lib/analytics";
import { listForumTags, listZones, postThread } from "@/lib/forum";
import { ForumImagePicker } from "../../_components/forum-image-picker";
import { useForumImagePicker } from "../../_components/use-forum-image-picker";
import { ComposerBodyField } from "../../_components/composer-body-field";

type ComposerMode = "share" | "question";

export function GlobalComposer({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("community");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const picker = useForumImagePicker();
  const [mode, setMode] = useState<ComposerMode>("share");
  const [zones, setZones] = useState<ZoneView[]>([]);
  const [tags, setTags] = useState<ForumTagView[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [zoneId, setZoneId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleZones = useMemo(
    () =>
      zones.filter((zone) => {
        if (zone.myStatus !== "ACTIVE") return false;
        if (mode === "question") return zone.type === "QA";
        if (zone.type === "CHAT") return true;
        return zone.type === "ANNOUNCEMENT" && zone.canModerate;
      }),
    [mode, zones],
  );
  const selectedZoneId = eligibleZones.some((zone) => zone.id === zoneId)
    ? zoneId
    : (eligibleZones[0]?.id ?? "");

  const open = () => {
    setError(null);
    dialogRef.current?.showModal();
    trackCommunityEvent("forum_composer_open", { mode });
    if (!zones.length && !loadingOptions) {
      setLoadingOptions(true);
      Promise.all([listZones(), listForumTags()])
        .then(([zoneResult, tagResult]) => {
          setZones(zoneResult.items);
          setTags(tagResult.filter((tag) => tag.isActive));
        })
        .catch(() => setError(t("error")))
        .finally(() => setLoadingOptions(false));
    }
  };

  const resetAndClose = () => {
    setTitle("");
    setBody("");
    setTagIds([]);
    setError(null);
    picker.reset();
    dialogRef.current?.close();
  };

  const submit = async () => {
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    if (!selectedZoneId || !normalizedBody || busy) return;
    if (mode === "question" && normalizedTitle.length < 5) {
      setError(t("composer_question_title_error"));
      return;
    }
    const zone = eligibleZones.find((entry) => entry.id === selectedZoneId);
    if (!zone) return;
    setBusy(true);
    setError(null);
    try {
      const attachments = await picker.uploadAll();
      await postThread(
        selectedZoneId,
        normalizedBody,
        normalizedTitle || undefined,
        attachments,
        tagIds,
      );
      trackCommunityEvent("forum_thread_created", {
        mode,
        zone_type: zone.type,
        tag_count: tagIds.length,
      });
      resetAndClose();
      onCreated();
    } catch (submitError) {
      setError(
        submitError instanceof ApiClientError ? submitError.body.message : t("error"),
      );
    } finally {
      setBusy(false);
    }
  };

  const selectMode = (nextMode: ComposerMode) => {
    setMode(nextMode);
    setZoneId("");
    trackCommunityEvent("forum_composer_open", { mode: nextMode });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="min-h-11 cursor-pointer rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] transition-[border-color,transform] duration-150 hover:border-[var(--community-blue-border)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      >
        <span className="text-[var(--community-blue-ink)]" aria-hidden>+</span>{" "}
        {t("composer_new")}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="forum-composer-title"
        onCancel={(event) => {
          event.preventDefault();
          resetAndClose();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) resetAndClose();
        }}
        className="mb-0 mt-auto w-full max-w-none rounded-t-[18px] border border-[#dfe2e7] bg-white p-0 shadow-[0_28px_80px_rgb(15_23_42_/_20%)] backdrop:bg-black/35 sm:m-auto sm:w-[min(94vw,48rem)] sm:rounded-[14px]"
      >
        <form
          method="dialog"
          className="max-h-[88vh] overflow-y-auto p-5 sm:p-7"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="forum-composer-title" className="flex items-center gap-3 text-[23px] font-extrabold tracking-[-0.03em] text-[#151923]">
                <span className="grid size-10 place-items-center rounded-[10px] bg-[var(--community-blue-soft)] text-[var(--community-blue-ink)]" aria-hidden><MessageCircle size={18} /></span>
                {t("composer_heading")}
              </h2>
            </div>
            <button
              type="button"
              aria-label={t("close")}
              onClick={resetAndClose}
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-[#6f7580] hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              ×
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2" role="tablist">
            {(["share", "question"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={mode === entry}
                onClick={() => selectMode(entry)}
                className={`flex min-h-11 items-center gap-2 rounded-[10px] border px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${mode === entry ? entry === "question" ? "border-[#dc5c49] bg-[#dc5c49] text-white" : "border-[var(--community-blue)] bg-[var(--community-blue)] text-[#111318]" : "border-[#dfe2e7] bg-[#f8f9fa] text-[#303540] hover:border-[var(--community-blue-border)] hover:bg-[var(--community-blue-soft)]"}`}
              >
                {entry === "share" ? <MessageCircle size={16} aria-hidden /> : <CircleHelp size={16} aria-hidden />}
                {entry === "share" ? t("composer_share") : t("composer_question")}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-bold text-[#2c3039]">
              {t("composer_zone")}
              <select
                value={selectedZoneId}
                onChange={(event) => setZoneId(event.target.value)}
                disabled={loadingOptions}
                required
                className="min-h-12 rounded-[10px] border border-[#e1e4e8] bg-[#fbfcfd] px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <option value="">{loadingOptions ? t("loading") : t("composer_zone_select")}</option>
                {eligibleZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-bold text-[#2c3039]">
              {mode === "question" ? t("composer_question_title") : t("composer_optional_title")}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={mode === "question" ? 5 : undefined}
                maxLength={200}
                required={mode === "question"}
                placeholder={t("composer_title_placeholder")}
                className="min-h-12 rounded-[10px] border border-[#e1e4e8] bg-[#fbfcfd] px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              />
            </label>

            <ComposerBodyField
              id="global-composer-body"
              label={t("composer_content")}
              value={body}
              onValueChange={setBody}
              disabled={busy}
              placeholder={t("composer_content_placeholder")}
              onSubmit={() => void submit()}
            />

            <fieldset>
              <legend className="text-sm font-bold text-[#2c3039]">
                <span className="inline-flex items-center gap-2"><Hash size={15} className="text-[var(--community-blue-ink)]" aria-hidden />{t("composer_tags")}</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = tagIds.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className={`flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-sm font-semibold transition-colors ${selected ? "border-[var(--community-blue-border)] text-[var(--community-blue-ink)]" : "border-[#e1e4e8] text-[#565c67] hover:border-[var(--community-blue-border)]"}`}
                      style={{
                        background: selected ? "var(--community-blue-soft)" : "#fbfcfd",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!selected && tagIds.length >= 3}
                        onChange={() =>
                          setTagIds((current) =>
                            selected
                              ? current.filter((id) => id !== tag.id)
                              : [...current, tag.id],
                          )
                        }
                        className="sr-only"
                      />
                      #{tag.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <div className="text-sm font-bold text-[#2c3039]">{t("composer_attachments")}</div>
              <ForumImagePicker picker={picker} disabled={busy} />
            </div>
          </div>

          {(error || picker.error) && (
            <p role="alert" className="mt-4 text-sm font-semibold" style={{ color: "var(--color-error, #9c2f2f)" }}>
              {error ?? picker.error}
            </p>
          )}
          {!loadingOptions && eligibleZones.length === 0 && (
            <p className="mt-4 rounded-xl bg-black/[0.035] p-3 text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("composer_no_zone")}
            </p>
          )}

          <div className="mt-7 flex justify-end gap-2 border-t border-[#eef0f3] pt-5">
            <button type="button" onClick={resetAndClose} className="min-h-11 rounded-[10px] border border-[#dfe2e7] bg-white px-5 text-sm font-bold text-[#343945]">
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={
                busy ||
                !selectedZoneId ||
                !body.trim() ||
                (mode === "question" && title.trim().length < 5)
              }
              className={`min-h-11 rounded-[10px] px-6 text-sm font-bold text-white disabled:bg-[#9aa0aa] disabled:opacity-100 ${mode === "question" ? "bg-[#dc5c49] hover:bg-[#c94f3d]" : "bg-[var(--community-blue)] text-[#111318] hover:bg-[var(--community-blue-hover)] hover:text-white"}`}
            >
              {busy ? t("compose_sending") : t("composer_submit")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
