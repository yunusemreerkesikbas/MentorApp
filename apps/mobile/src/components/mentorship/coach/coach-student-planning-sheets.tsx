import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { MentorshipProgramTemplateDto } from "@mentor/types";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { FormSheet } from "../../panel/primitives.js";
import { AppText, Button, ConfirmDialog, TextField } from "../../ui/index.js";

export function PlanningTemplateSheets({
  saveVisible,
  loadVisible,
  templates,
  busy,
  onCloseSave,
  onCloseLoad,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
}: {
  saveVisible: boolean;
  loadVisible: boolean;
  templates: MentorshipProgramTemplateDto[];
  busy: boolean;
  onCloseSave: () => void;
  onCloseLoad: () => void;
  onSaveTemplate: (name: string) => void;
  onLoadTemplate: (template: MentorshipProgramTemplateDto) => void;
  onDeleteTemplate: (templateId: string) => void;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { palette, radii, space } = useThemeTokens();
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<MentorshipProgramTemplateDto | null>(
    null,
  );

  return (
    <>
      <FormSheet
        visible={saveVisible}
        title={t("template_save")}
        closeLabel={tCommon("close")}
        closeDisabled={busy}
        onClose={onCloseSave}
      >
        <TextField
          label={t("template_name")}
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Button
          label={t("template_save")}
          disabled={!name.trim()}
          loading={busy}
          onPress={() => {
            onSaveTemplate(name.trim());
            setName("");
          }}
        />
      </FormSheet>

      <FormSheet
        visible={loadVisible}
        title={t("template_load")}
        closeLabel={tCommon("close")}
        closeDisabled={busy}
        onClose={onCloseLoad}
      >
        {templates.length === 0 ? (
          <AppText variant="body" tone="secondary">
            {t("template_none")}
          </AppText>
        ) : (
          <View style={{ gap: space.sm }}>
            {templates.map((tpl) => (
              <View
                key={tpl.id}
                style={[
                  styles.tplCard,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                    borderRadius: radii.inner,
                  },
                ]}
              >
                <View style={{ gap: 2 }}>
                  <AppText variant="cardTitle">{tpl.name}</AppText>
                  <AppText variant="micro" tone="secondary">
                    {t("template_option", { name: tpl.name, count: tpl.tasks.length })}
                    {tpl.examType ? ` · ${tpl.examType}` : ""}
                  </AppText>
                </View>
                <View style={styles.tplActions}>
                  <Button
                    label={t("template_apply_cta")}
                    disabled={busy}
                    onPress={() => {
                      onLoadTemplate(tpl);
                      onCloseLoad();
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t("template_delete_action")}
                    variant="danger"
                    disabled={busy}
                    onPress={() => setPendingDelete(tpl)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </FormSheet>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t("template_delete_title")}
        message={t("template_delete_body", { name: pendingDelete?.name ?? "" })}
        confirmLabel={t("template_delete_action")}
        cancelLabel={t("cancel_preview_cta")}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onDeleteTemplate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tplCard: {
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  tplActions: {
    flexDirection: "row",
    gap: 8,
  },
});
