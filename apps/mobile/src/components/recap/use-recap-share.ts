import { useCallback, useRef, useState, type ComponentRef } from "react";
import type { View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { createRecapShareLock } from "./recap-flow.js";

export function useRecapShare() {
  const t = useTranslations("recap");
  const toast = useToast();
  const view = useRef<ComponentRef<typeof View> | null>(null);
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareOnce] = useState(createRecapShareLock);

  const cardRef = useCallback((card: ComponentRef<typeof View> | null) => {
    view.current = card;
    if (!card) setReady(false);
  }, []);
  const onImageReady = useCallback(() => setReady(true), []);

  const share = () => {
    const card = view.current;
    if (!card || !ready) return;

    void shareOnce(async () => {
      setSharing(true);
      try {
        if (!(await Sharing.isAvailableAsync())) {
          toast.show(t("share_error"));
          return;
        }

        // The receiving app may read the PNG after the chooser closes; keep the native cache file.
        const uri = await captureRef(card, { format: "png", result: "tmpfile" });
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("share_card_title") });
      } catch {
        toast.show(t("share_error"));
      } finally {
        setSharing(false);
      }
    });
  };

  return { cardRef, onImageReady, share, sharing, ready };
}
