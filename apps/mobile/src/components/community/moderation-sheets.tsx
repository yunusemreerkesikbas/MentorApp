import { useMemo } from "react";
import { ApiClientError } from "@mentor/api-client";
import { ReportReason, type ModerationTargetType } from "@mentor/types";
import { createForumReport } from "../../lib/forum-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { ActionSheet, type SheetAction } from "../panel/primitives.js";
import { ConfirmDialog } from "../ui/index.js";

export interface ReportTarget {
  targetType: ModerationTargetType;
  targetId: string;
}

export function ReportReasonSheet({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const t = useTranslations("community");
  const toast = useToast();

  const actions = useMemo<SheetAction[]>(() => {
    if (!target) return [];
    const reasons: Array<{ reason: ReportReason; label: string }> = [
      { reason: ReportReason.SPAM, label: t("report_spam") },
      { reason: ReportReason.HARASSMENT, label: t("report_harassment") },
      { reason: ReportReason.OFF_TOPIC, label: t("report_off_topic") },
      { reason: ReportReason.OTHER, label: t("report_other") },
    ];
    return reasons.map((item) => ({
      label: item.label,
      onPress: () => {
        void createForumReport({
          targetType: target.targetType,
          targetId: target.targetId,
          reason: item.reason,
        })
          .then(() => toast.show(t("report_done")))
          .catch((err: unknown) => {
            toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
          });
      },
    }));
  }, [t, target, toast]);

  return (
    <ActionSheet
      title={target ? t("report_reason") : null}
      actions={actions}
      onClose={onClose}
    />
  );
}

export function DeleteForumConfirmDialog({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("community");
  const tCommon = useTranslations("common");

  return (
    <ConfirmDialog
      visible={visible}
      title={t("delete_confirm_title")}
      message={t("delete_confirm")}
      confirmLabel={t("delete")}
      cancelLabel={tCommon("cancel")}
      destructive
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
