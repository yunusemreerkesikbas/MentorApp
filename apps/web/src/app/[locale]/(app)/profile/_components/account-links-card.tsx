"use client";
import { CalendarDays, ChevronRight, CreditCard, GraduationCap, LogOut, Scale, Trash2 } from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useState, type ComponentProps, type ReactElement } from "react";
import type { AuthUser, ExamType, ExamVariant } from "@mentor/types";
import { ApiClientError, http, usersControllerUpdateMe } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import { useAuth } from "@/lib/auth-context";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { FormError } from "@/components/form";
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
  danger = false,
}: {
  children: string;
  danger?: boolean;
  description?: number | string;
  externalHref?: string;
  href?: ComponentProps<typeof Link>["href"];
  icon: ReactElement;
  onClick?: () => void;
  showChevron?: boolean;
  trailing?: ReactElement;
}) {
  // Nuton list item ~56px (DESIGN.md §4); keep ≥44px touch via min-h-11.
  const className =
    "flex min-h-14 w-full min-w-0 items-center justify-between gap-3 bg-white px-3 py-1.5 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";
  const style = { color: danger ? "var(--color-danger)" : "var(--color-main)" };
  const label = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-card)] text-[var(--color-main)]" style={style}>
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
  const tLegal = useTranslations("legal");
  const locale = useLocale();
  const { logout } = useAuth();
  const router = useRouter();
  const { actionSheet } = useMentorBottomSheet();
  const toast = useMentorToast();
  const { confirm } = useMentorDialog();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const joined = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(user.createdAt));
  const examOptions: ExamType[] = ["KPSS", "YKS", "LGS"];
  const variantOptions: ExamVariant[] = ["LISANS", "ONLISANS", "ORTAOGRETIM"];
  // Shown on the row so the level is visible without opening the sheet — it decides which exam
  // date is counted down to, which is too consequential to keep hidden.
  const examSummary = user.examType
    ? user.examVariant
      ? `${user.examType} · ${tExam(`variant.${user.examVariant}`)}`
      : user.examType
    : undefined;

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
    if (result === "cancel") return;
    const examType = result as ExamType;

    // KPSS needs a second answer before anything is saved: its three guides have different exam
    // dates, so writing the family alone would leave the countdown on whichever row is `isCurrent`.
    let examVariant: ExamVariant | null = null;
    if (examType === "KPSS") {
      const level = await actionSheet({
        title: tExam("variant_label"),
        actions: variantOptions.map((value) => ({
          id: value,
          label: tExam(`variant.${value}`),
          icon: user.examVariant === value ? "check-circle" : undefined,
          showChevron: false,
        })),
      });
      if (level === "cancel") return;
      examVariant = level as ExamVariant;
    }

    if (examType === user.examType && examVariant === user.examVariant) return;

    try {
      const updated = (await usersControllerUpdateMe({
        examType,
        examVariant,
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
    }
  }

  async function deleteAccount() {
    if (deleting) return;

    const confirmed = await confirm({
      title: t("delete_account.title"),
      message: t("delete_account.description"),
      confirmLabel: t("delete_account.confirm_cta"),
      cancelLabel: t("delete_account.cancel"),
    });
    if (!confirmed) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      await http<void>("/v1/account", { method: "DELETE" });
      await logout();
      router.replace("/");
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError
          ? err.body.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
      setDeleting(false);
    }
  }

  return (
    <Card solid className="p-4">
      <SectionHeading>{tAccount("title")}</SectionHeading>
      <div className="mt-3 divide-y divide-black/10 overflow-hidden rounded-[var(--radius-card)]">
        <ListRow
          icon={<GraduationCap size={22} aria-hidden />}
          description={examSummary}
          onClick={() => void openExamSheet()}
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
        <ListRow href="/subscription" icon={<CreditCard size={20} aria-hidden />}>
          {tAccount("subscription")}
        </ListRow>
        {/* The app has no footer (bottom nav owns that space), so this is the in-app way in. */}
        <ListRow
          href={{ pathname: "/legal/[slug]", params: { slug: "kullanim-kosullari" } }}
          icon={<Scale size={20} aria-hidden />}
        >
          {tLegal("profile_section")}
        </ListRow>
        <ListRow
          icon={<LogOut size={20} aria-hidden />}
          onClick={() => void logout()}
          showChevron={false}
        >
          {tAccount("logout")}
        </ListRow>
        <ListRow
          danger
          icon={<Trash2 size={20} aria-hidden />}
          onClick={() => void deleteAccount()}
          showChevron={false}
        >
          {deleting ? t("delete_account.deleting") : t("delete_account.cta")}
        </ListRow>
      </div>
      {deleteError ? (
        <div className="mt-3"><FormError message={deleteError} /></div>
      ) : null}
    </Card>
  );
}
