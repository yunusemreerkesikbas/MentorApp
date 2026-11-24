import { useCallback, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import { usePreventRemove } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@mentor/api-client";
import { captureRef, releaseCapture } from "react-native-view-shot";
import { listForumZones, postZoneThread } from "../../lib/forum-api.js";
import { uploadPicture } from "../../lib/vision-board-api.js";
import { boardErrorKey, shareRooms } from "../../lib/vision-board-view.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { AppText, Button, Chip, TextField } from "../ui/index.js";
import { BoardStage, type BoardStageStatus } from "./board-stage.js";
import { Wrap } from "./screen.js";
import type { VisionBoardDoc } from "@mentor/types";

const CAPTION_LIMIT = 500;
const JPEG_WIDTH = 1200;

export function BoardShare({ doc, onClose }: { doc: VisionBoardDoc; onClose: () => void }) {
  const t = useTranslations("visionBoard");
  const queryClient = useQueryClient();
  const toast = useToast();
  const preview = useRef<ComponentRef<typeof View> | null>(null);
  const previewSize = useRef({ width: 0, height: 0 });
  const postingRef = useRef(false);
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState<BoardStageStatus>("loading");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [selected, setSelected] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const zones = useQuery({ queryKey: ["forum", "zones"], queryFn: listForumZones });
  const rooms = shareRooms(zones.data ?? []);
  const room = rooms.find(candidate => candidate.id === selected);

  usePreventRemove(true, useCallback(() => {
    if (!postingRef.current) onClose();
  }, [onClose]));

  async function post() {
    const body = caption.trim();
    if (!room || !body || !preview.current || status !== "ready" || postingRef.current) return;
    postingRef.current = true;
    setPosting(true);
    setError(null);
    let uri: string | undefined;
    try {
      const { width, height } = previewSize.current;
      const jpegHeight = Math.round(JPEG_WIDTH * height / width);
      uri = await captureRef(preview.current, {
        format: "jpg", result: "tmpfile", quality: 0.85, width: JPEG_WIDTH, height: jpegHeight,
      });
      const mimeType = "image/jpeg";
      const key = await uploadPicture({ uri, mimeType, width: JPEG_WIDTH, height: jpegHeight }, "forum");
      await postZoneThread({ zoneId: room.id, body, attachments: [{ key, mimeType }] });
      void queryClient.invalidateQueries({ queryKey: ["forum"] });
      toast.show(t("sharePosted"));
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiClientError ? failure.body.message : t(boardErrorKey(failure)));
    } finally {
      if (uri) releaseCapture(uri);
      postingRef.current = false;
      setPosting(false);
    }
  }

  return <>
    <View ref={preview} collapsable={false} onLayout={event => {
      previewSize.current = event.nativeEvent.layout;
    }}>
      <BoardStage key={previewAttempt} doc={doc} onStatusChange={setStatus} />
    </View>
    {status === "loading" && <AppText accessibilityLiveRegion="polite">{t("loading")}</AppText>}
    {status === "unavailable" && <>
      <AppText tone="danger" accessibilityLiveRegion="polite">{t("shareUnavailable")}</AppText>
      <Button label={t("retry")} variant="secondary" onPress={() => {
        setStatus("loading");
        setPreviewAttempt(previous => previous + 1);
      }} />
    </>}
    {zones.isPending ? <AppText>{t("loading")}</AppText> : zones.isError ? <>
      <AppText tone="danger">{zones.error instanceof ApiClientError ? zones.error.body.message : t("failure")}</AppText>
      <Button label={t("retry")} variant="secondary" onPress={() => void zones.refetch()} />
    </> : rooms.length === 0 ? <AppText>{t("roomEmpty")}</AppText> : <>
      <AppText variant="cardTitle">{t("room")}</AppText>
      <Wrap>
        {rooms.map(candidate => <Chip key={candidate.id} label={candidate.title}
          selected={selected === candidate.id} onPress={posting ? undefined : () => setSelected(candidate.id)} />)}
      </Wrap>
      <TextField label={t("note")} hint={t("sharePrivate")} value={caption}
        onChangeText={setCaption} maxLength={CAPTION_LIMIT} editable={!posting} multiline />
      {error && <AppText tone="danger" accessibilityLiveRegion="polite">{error}</AppText>}
      <Button label={t("sharePost")} loading={posting}
        disabled={posting || !room || !caption.trim() || status !== "ready"} onPress={() => void post()} />
    </>}
    <Button label={t("back")} variant="secondary" disabled={posting} onPress={onClose} />
  </>;
}
