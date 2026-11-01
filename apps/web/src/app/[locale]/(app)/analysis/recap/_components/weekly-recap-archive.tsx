"use client";
import type { Paginated, WeeklyRecapArchiveItemDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { useTranslations } from "next-intl";

export function WeeklyRecapArchive({ archive, busy, onRead, onPage }: {
  archive: Paginated<WeeklyRecapArchiveItemDto>; busy: boolean;
  onRead: (item: WeeklyRecapArchiveItemDto) => void; onPage: (page: number) => void;
}) {
  const t = useTranslations("analysis.recap.ownership");
  return <section aria-labelledby="recap-archive-title" className="mt-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
    <h2 id="recap-archive-title" className="text-xl font-bold text-[var(--color-main)]">{t("archive")}</h2>
    {archive.items.length ? <ul className="mt-4 divide-y divide-[var(--color-border)]">
      {archive.items.map((item) => <li key={item.id}>
        <button disabled={busy} onClick={() => onRead(item)} className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
          <span>{item.weekStart} · {item.endDate}</span><span className="text-sm font-bold">{t("replay")}</span>
        </button>
      </li>)}
    </ul> : <p className="mt-3 text-[var(--color-secondary)]">{t("archive_empty")}</p>}
    {archive.total > archive.pageSize ? <div className="mt-4 flex justify-between gap-3">
      <Button variant="secondary" disabled={busy || archive.page <= 1} onClick={() => onPage(archive.page - 1)}>{t("previous_page")}</Button>
      <Button variant="secondary" disabled={busy || archive.page * archive.pageSize >= archive.total} onClick={() => onPage(archive.page + 1)}>{t("next_page")}</Button>
    </div> : null}
  </section>;
}
