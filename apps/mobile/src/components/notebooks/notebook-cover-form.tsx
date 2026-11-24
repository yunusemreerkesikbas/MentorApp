import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExamType, NOTEBOOK_COVER_COLORS, NOTEBOOK_COVER_MATERIALS, NOTEBOOK_COVER_TITLE_MAX_LENGTH, type NotebookCoverStyle, type NotebookSummaryDto } from "@mentor/types";
import { fetchExamTaxonomy } from "../../lib/analysis-api.js";
import { createBook, deleteBook, updateBook } from "../../lib/notebook-api.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { NotebookCover } from "./notebook-cover.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText, Button, Chip, ConfirmDialog, TextField } from "../ui/index.js";

export function NotebookCoverForm({ book, close }: { book?: NotebookSummaryDto; close: () => void }) {
  const t = useTranslations("notebooks");
  const { user } = useAuth();
  const { locale } = useLocale();
  const { space } = useThemeTokens();
  const client = useQueryClient();
  const exam = user?.examType ?? ExamType.YKS;
  const variant = user?.examVariant ?? null;
  const taxonomy = useQuery({ queryKey: ["exam-taxonomy", exam, variant, locale], queryFn: () => fetchExamTaxonomy(exam, variant) });
  const [name, setName] = useState(book?.title ?? "");
  const [cover, setCover] = useState<NotebookCoverStyle>(book?.cover ?? { color: "navy", material: "cloth" });
  const [subject, setSubject] = useState(book?.subjectRef ?? null);
  const scope = subject === (book?.subjectRef ?? null) && book ? {} : { subjectRef: subject, examId: subject ? taxonomy.data?.exam.id : null };
  const save = useMutation({
    mutationFn: () => book ? updateBook(book.id, { title: name.trim() || null, cover, ...scope }) : createBook({ title: name.trim(), cover, ...scope }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["notebook"] }); close(); },
  });
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteBook(book!.id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["notebook"] }); close(); },
  });
  const busy = save.isPending || remove.isPending;
  const row = { flexDirection: "row", flexWrap: "wrap", gap: space.sm } as const;
  return <FormSheet visible title={t(book ? "edit" : "create")} closeLabel={t("close")} onClose={close} closeDisabled={busy}>
    <View style={{ alignSelf: "center", width: 124 }}><NotebookCover cover={cover} title={name || t(book?.kind === "MISTAKE" ? "mistakes" : "name")} /></View>
    <TextField label={t("name")} value={name} onChangeText={setName} maxLength={NOTEBOOK_COVER_TITLE_MAX_LENGTH} />
    <AppText>{t("color")}</AppText><View style={row}>{NOTEBOOK_COVER_COLORS.map(color =>
      <Chip key={color} label={t(color)} selected={cover.color === color} onPress={() => setCover({ ...cover, color })} />)}</View>
    <AppText>{t("material")}</AppText><View style={row}>{NOTEBOOK_COVER_MATERIALS.map(material =>
      <Chip key={material} label={t(material)} selected={cover.material === material} onPress={() => setCover({ ...cover, material })} />)}</View>
    {book?.kind !== "MISTAKE" && taxonomy.data && (!book?.examId || book.examId === taxonomy.data.exam.id) ?
      <><AppText>{t("subject")}</AppText><View style={row}><Chip label={t("all")} selected={!subject} onPress={() => setSubject(null)} />
        {taxonomy.data.subjects.map(s => <Chip key={s.slug} label={s.name} selected={subject === s.slug} onPress={() => setSubject(s.slug)} />)}</View></> : null}
    {save.isError ? <AppText tone="danger">{save.error.message || t("error")}</AppText> : null}
    <Button label={t("save")} disabled={!name.trim() && book?.kind !== "MISTAKE"} loading={save.isPending} onPress={() => save.mutate()} />
    {book?.kind === "CUSTOM" ? <>
      <Button variant="danger" label={t("delete")} loading={remove.isPending} disabled={busy} onPress={() => setConfirming(true)} />
      {remove.isError ? <AppText tone="danger">{t("deleteError")}</AppText> : null}
      <ConfirmDialog visible={confirming} destructive title={t("deleteTitle", { title: book.title ?? t("name") })} message={t("deleteBody")}
        confirmLabel={t("delete")} cancelLabel={t("cancel")}
        onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); remove.mutate(); }} />
    </> : null}
  </FormSheet>;
}
