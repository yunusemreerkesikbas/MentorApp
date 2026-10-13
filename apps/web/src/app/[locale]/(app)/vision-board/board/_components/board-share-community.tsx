"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { FORUM_IMAGE_MAX_BYTES, type ThreadView, type VisionBoardDoc, type ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextAreaField } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { MenuSelect } from "@/components/menu-select";
import { LEDGE, LEDGE_FILLED, PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import {
  BoardExportTaintedError,
  renderBoardWithinBytes,
} from "@/components/vision-board/board-export";
import { trackCommunityEvent } from "@/lib/analytics";
import { postThread } from "@/lib/forum";
import { uploadForumImage } from "@/lib/forum-attachments";
import { eligibleComposerZones } from "../../../community/_components/composer-audience";

/** A caption, not an essay: the picture is the post. The forum itself allows far more. */
const NOTE_MAX_LENGTH = 500;

/**
 * The share window's second step: the board goes into a room as a post with its picture.
 *
 * Nothing new on the server. The picture is uploaded the way any post's picture is and the post is
 * an ordinary one, so the room's own rules and moderation apply to it unchanged.
 */
export function BoardShareCommunity({
  doc,
  zones,
  previewUrl,
  onBack,
  onShared,
}: {
  doc: VisionBoardDoc;
  /** Every room the viewer can see; the ones they can post a picture to are picked out here. */
  zones: ZoneView[];
  /** The board's picture as the window already drew it, for the thumbnail. */
  previewUrl: string | null;
  onBack: () => void;
  onShared: (thread: ThreadView) => void;
}) {
  const t = useTranslations("vision.board");
  const roomLabelId = useId();
  const rooms = useMemo(() => eligibleComposerZones(zones, "share"), [zones]);
  // With one room there is nothing to choose.
  const [roomId, setRoomId] = useState(() => (rooms.length === 1 ? rooms[0]!.id : ""));
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const room = rooms.find((candidate) => candidate.id === roomId) ?? null;

  const backLink = (
    <button
      type="button"
      disabled={posting}
      onClick={onBack}
      className={`${PANEL_QUIET_LINK} w-full justify-center`}
    >
      {t("community_back")}
    </button>
  );

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-sm font-semibold text-[var(--color-body)]">
          {t("community_no_room")}
        </p>
        <Link href="/community" className={`${LEDGE} ${LEDGE_FILLED} w-full`}>
          {t("community_go")}
        </Link>
        {backLink}
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = note.trim();
    if (!room || !body || posting) return;
    setPosting(true);
    setError(null);
    try {
      // A JPEG under the forum's cap: a photo-heavy board as a PNG would be refused by the upload.
      const picture = await renderBoardWithinBytes(doc, FORUM_IMAGE_MAX_BYTES);
      const attachment = await uploadForumImage(
        new File([picture], `${t("file_name")}.jpg`, { type: "image/jpeg" }),
      );
      const thread = await postThread(room.id, body, undefined, [attachment]);
      trackCommunityEvent("forum_thread_created", {
        mode: "share",
        zone_type: room.type,
        tag_count: 0,
      });
      onShared(thread);
    } catch (failure) {
      // The server's own words when it has them: a room's rule reads better than a guess at it.
      setError(
        failure instanceof BoardExportTaintedError
          ? t("export_blocked")
          : failure instanceof ApiClientError
            ? failure.body.message
            : t("community_failed"),
      );
      setPosting(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] p-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a blob drawn a moment ago, not a remote asset
          <img src={previewUrl} alt="" className="h-16 w-auto shrink-0" />
        ) : (
          <span aria-hidden className="h-16 w-24 shrink-0" />
        )}
        <p className="text-sm font-semibold text-[var(--color-body)]">{t("community_attached")}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span id={roomLabelId} className="text-xs font-semibold text-[var(--color-secondary)]">
          {t("community_room")}
        </span>
        <MenuSelect
          // The kit field's shadow: on a white window the select's own hairline is white on white.
          className="rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
          value={roomId}
          onChange={setRoomId}
          disabled={posting}
          aria-labelledby={roomLabelId}
          options={[
            { value: "", label: t("community_room_choose") },
            ...rooms.map((candidate) => ({ value: candidate.id, label: candidate.title })),
          ]}
        />
      </div>

      <TextAreaField
        dense
        label={t("community_note")}
        placeholder={t("community_note_placeholder")}
        // Said before the post, where it can still change the decision: a board carries photos.
        hint={t("community_privacy")}
        maxLength={NOTE_MAX_LENGTH}
        disabled={posting}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      {error ? (
        <p role="alert" className="text-center text-body-sm font-semibold text-[var(--color-main)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <Button type="submit" fullWidth busy={posting} disabled={!room || !note.trim()}>
          {t("share")}
        </Button>
        {backLink}
      </div>
    </form>
  );
}
