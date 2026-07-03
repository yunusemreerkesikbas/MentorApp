"use client";

import { useLocale, useTranslations } from "next-intl";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import CreditCard from "lucide-react/dist/esm/icons/credit-card.mjs";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.mjs";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap.mjs";
import LogOut from "lucide-react/dist/esm/icons/log-out.mjs";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import type { ReactElement } from "react";
import type { AuthUser, ExamType } from "@mentor/types";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import { useAuth } from "@/lib/auth-context";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";

export function ListRow({
  children,
  description,
  externalHref,
  href,
  icon,
  onClick,
  showChevron = true,
  trailing,
}: {
  children: string;
  description?: number | string;
  externalHref?: string;
  href?: string;
  icon: ReactElement;
  onClick?: () => void;
  showChevron?: boolean;
  trailing?: ReactElement;
}) {
  const className =
    "flex min-h-[60px] w-full min-w-0 items-center justify-between gap-3 bg-white px-3 py-2 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";
  const style = { color: "var(--color-main)" };
  const label = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] text-[var(--color-main)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className="block truncate text-base font-bold"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {children}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-sm text-[var(--color-secondary)]">
            {description}
          </span>
        ) : null}
      </span>
    </span>
  );
  const end = trailing ?? (showChevron ? (
    <ChevronRight className="shrink-0 text-[var(--color-secondary)]" size={20} strokeWidth={2} aria-hidden />
  ) : null);

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {label}
        {end}
      </Link>
    );
  }

  if (externalHref) {
    return (
      <a
        href={externalHref}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={style}
      >
        {label}
        {end}
      </a>
    );
  }

  if (!onClick) {
    return (
      <div className={className} style={style}>
        {label}
        {end}
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {label}
      {end}
    </button>
  );
}

/** Nuton list-item rows (335×56) — account shortcuts. */
export function AccountLinksCard({
  onSaved,
  user,
}: {
  onSaved: (user: AuthUser) => void;
  user: AuthUser;
}) {
  const t = useTranslations("profile");
  const tAccount = useTranslations("profile.account");
  const tExam = useTranslations("profile.exam_settings");
  const locale = useLocale();
  const { logout } = useAuth();
  const { actionSheet } = useMentorBottomSheet();
  const toast = useMentorToast();
  const [savingExam, setSavingExam] = useState(false);
  const joined = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(user.createdAt));
  const examOptions: ExamType[] = ["KPSS", "YKS", "LGS"];

  async function openExamSheet() {
    const result = await actionSheet({
      title: tExam("title"),
      actions: examOptions.map((exam) => ({
        id: exam,
        label: exam,
        icon: user.examType === exam ? "check-circle" : undefined,
        showChevron: false,
      })),
    });
    if (result === "cancel" || result === user.examType) return;

    setSavingExam(true);
    try {
      const updated = (await usersControllerUpdateMe({
        examType: result as ExamType,
      })) as unknown as AuthUser;
      onSaved(updated);
      toast.success({
        title: tExam("saved_toast_title"),
        message: tExam("saved_toast_message"),
        duration: 3000,
      });
    } catch (err) {
      toast.error({
        title: tExam("save_error"),
        message: err instanceof ApiClientError ? err.body.message : tExam("save_error"),
        duration: 3000,
      });
    } finally {
      setSavingExam(false);
    }
  }

  return (
    <Card solid className="p-4">
      <SectionHeading>{tAccount("title")}</SectionHeading>
      <div className="mt-3 divide-y divide-black/10 overflow-hidden rounded-[var(--radius-card)]">
        <ListRow
          icon={<GraduationCap size={22} aria-hidden />}
          onClick={() => void openExamSheet()}
          description={savingExam ? tExam("saved") : (user.examType ?? t("exam_empty"))}
        >
          {t("exam_label")}
        </ListRow>
        <ListRow
          icon={<CalendarDays size={22} aria-hidden />}
          description={joined}
          showChevron={false}
        >
          {t("member_since")}
        </ListRow>
        <ListRow href="/abonelik" icon={<CreditCard size={20} aria-hidden />}>
          {tAccount("subscription")}
        </ListRow>
        <ListRow
          icon={<LogOut size={20} aria-hidden />}
          onClick={() => void logout()}
          showChevron={false}
        >
          {tAccount("logout")}
        </ListRow>
      </div>
    </Card>
  );
}
