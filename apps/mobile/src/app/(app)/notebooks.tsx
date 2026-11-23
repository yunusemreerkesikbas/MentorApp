import { useState } from "react";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { NotebookSummaryDto } from "@mentor/types";
import { NotebookCoverForm } from "../../components/notebooks/notebook-cover-form.js";
import { NotebookFrame, NotebookError } from "../../components/notebooks/notebook-frame.js";
import { Pressable, View } from "react-native";
import { NotebookCapacity } from "../../components/notebooks/notebook-capacity.js";
import { NotebookCover } from "../../components/notebooks/notebook-cover.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button, Skeleton } from "../../components/ui/index.js";
import { listBooks } from "../../lib/notebook-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";

export default function NotebooksDesk() {
  const router = useRouter();
  const t = useTranslations("notebooks");
  const { scenes, space, radii } = useThemeTokens();
  const [capacity, setCapacity] = useState(false);
  const [editing, setEditing] = useState<NotebookSummaryDto | "new" | null>(null);
  const books = useInfiniteQuery({ queryKey: ["notebook", "desk"], initialPageParam: 1, queryFn: ({ pageParam }) => listBooks(pageParam),
    getNextPageParam: p => p.page * p.pageSize < p.total ? p.page + 1 : undefined });
  const items = books.data?.pages.flatMap(p => p.items) ?? [];
  const limits = items.find(book => book.limits)?.limits;
  const full = limits?.maxCustomNotebooks != null && limits.customNotebookCount >= limits.maxCustomNotebooks;
  return <NotebookFrame title={t("title")} onBack={() => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/dashboard")}>
    <Button label={t("create")} onPress={() => full ? setCapacity(true) : setEditing("new")} />
    {books.isPending && <Skeleton height={100} />}
    {books.isError && <NotebookError retry={() => void books.refetch()} />}
    {items.length > 0 && <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between",
      rowGap: space.xl, padding: space.md, borderRadius: radii.card, backgroundColor: scenes.roomStage.LIBRARY.groundFrom,
      borderBottomColor: scenes.roomStage.LIBRARY.table, borderBottomWidth: space.sm }}>
      {items.map(book => <View key={book.id} style={{ width: "48%", gap: space.xs }}>
        <Pressable accessibilityRole="button" accessibilityLabel={book.title ?? t("mistakes")}
          onPress={() => router.push({ pathname: "/(app)/notebook" as never, params: { notebookId: book.id } })}>
          <NotebookCover title={book.title ?? t("mistakes")} cover={book.cover} subtitle={book.subjectName ?? t("pages", { n: book.pageCount })} />
        </Pressable>
        <Button variant="secondary" label={t("edit")} onPress={() => setEditing(book)} />
      </View>)}
    </View>}
    {capacity && <NotebookCapacity count={limits?.customNotebookCount ?? 0} close={() => setCapacity(false)} />}
    {books.hasNextPage && <Button label={t("more")} loading={books.isFetchingNextPage} onPress={() => void books.fetchNextPage()} />}
    {editing && <NotebookCoverForm book={editing === "new" ? undefined : editing} close={() => setEditing(null)} />}
  </NotebookFrame>;
}
