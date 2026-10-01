"use client";

import { useEffect, type FormEventHandler, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Modal } from "@mentor/ui";

/**
 * The one overlay every short room flow uses: create, join, invite. A bottom sheet on phones
 * and a centred dialog from `lg` up (the kit `Modal` with `placement="sheet"`).
 *
 * Portalled to `document.body` on purpose. Rendered in place it sat inside `.room-stage`, whose
 * token remap printed the room's cream ink on the white sheet (the invite code was unreadable),
 * and on a phone it was trapped inside a `backdrop-filter` card under the tab bar. The body
 * portal gives it the app's own tokens; the native `<dialog>` top layer lifts it over every
 * piece of chrome and brings focus containment and Escape with it.
 *
 * Nothing may open a kit confirm on top of it: that viewport is not in the top layer and would
 * sit inert behind the sheet. Ask inside the sheet instead.
 */
export function RoomSheet({
  open,
  onClose,
  title,
  children,
  banner,
  footer,
  onSubmit,
  closeDisabled,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Rendered edge to edge above the title — the theme preview. */
  banner?: ReactNode;
  footer?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  closeDisabled?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("common.dialog");

  // The stage behind a sheet should not scroll under the thumb that is filling it in.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <Modal
      title={title}
      closeLabel={t("close")}
      onClose={onClose}
      banner={banner}
      footer={footer}
      onSubmit={onSubmit}
      closeDisabled={closeDisabled}
      initialFocusRef={initialFocusRef}
      placement="sheet"
    >
      {children}
    </Modal>,
    document.body,
  );
}
