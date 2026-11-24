import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import { usePreventRemove } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { VisionBoardDoc, VisionDto } from "@mentor/types";
import { openBoard } from "../../lib/vision-board-view.js";
import { saveBoard } from "../../lib/vision-board-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";

const AUTOSAVE_MS = 2000;

export function useBoardDraft(vision: VisionDto, uploading: boolean, sharing: boolean) {
  const client = useQueryClient();
  const t = useTranslations("visionBoard");
  const [doc, setDoc] = useState(() => openBoard(vision));
  const latest = useRef(doc);
  const [saved, setSaved] = useState<VisionBoardDoc | null>(vision.board);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const dirty = saved !== doc;
  const edit = useCallback((change: (current: VisionBoardDoc) => VisionBoardDoc) => {
    const next = change(latest.current);
    latest.current = next;
    setDoc(next);
    setError(null);
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const persist = useCallback(async (snapshot: VisionBoardDoc) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await saveBoard(snapshot);
      client.setQueryData(["coaching", "vision"], response);
      if (mounted.current) setSaved(snapshot);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof ApiClientError ? failure.body.message : t("failure"));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [client, t]);
  useEffect(() => {
    if (!dirty || saving || error || confirming) return;
    const timer = setTimeout(() => void persist(doc), AUTOSAVE_MS);
    autosaveTimer.current = timer;
    return () => clearTimeout(timer);
  }, [dirty, saving, error, confirming, doc, persist]);
  usePreventRemove(!sharing && (dirty || saving || uploading), ({ repeat }) => {
    if (busy.current || uploading || confirming) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setConfirming(true);
    Alert.alert(t("savePending"), undefined, [
      { text: t("stay"), style: "cancel", onPress: () => setConfirming(false) },
      { text: t("discard"), style: "destructive", onPress: repeat },
    ], { cancelable: true, onDismiss: () => setConfirming(false) });
  });
  return { doc, edit, dirty, saving, error, save: () => persist(latest.current) };
}
