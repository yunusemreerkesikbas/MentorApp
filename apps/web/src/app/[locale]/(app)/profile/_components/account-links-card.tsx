"use client";
import {
  CalendarDays,
  ChevronRight,
  CreditCard,
  GraduationCap,
  LogOut,
  Scale,
  Trash2,
  UserRound,
} from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useState, type ComponentProps, type ReactElement } from "react";
import type { AuthUser, ExamType, ExamVariant } from "@mentor/types";
import {
  ApiClientError,
  http,
  usersControllerUpdateMe,
} from "@mentor/api-client";
import { Card } from "@mentor/ui";
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
  // Compact list item (44px min touch target, reduced padding matching reference design).
  const className =
    "group flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-[calc(var(--radius-card)-2px)] px-3 py-1.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";
  const style = { color: danger ? "var(--color-danger)" : "var(--color-main)" };
  const label = (
    <span className="flex min-w-0 items-center gap-3">
      <span
        className="flex size-7 shrink-0 items-center justify-center transition-colors"
        style={{
          color: danger ? "var(--color-danger)" : "var(--color-secondary)",
        }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className="block truncate text-sm font-medium leading-5"
          style={{
            color: danger ? "var(--color-danger)" : "var(--color-main)",
            fontFamily: "var(--font-body)",
          }}
        >
          {children}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--color-secondary)]">
            {description}
          </span>
        ) : null}
      </span>
    </span>
  );
  const end =
    trailing ??
    (showChevron ? (
      <ChevronRight
        className="shrink-0 text-[var(--color-secondary)]/60 transition-colors group-hover:text-[var(--color-secondary)]"
        size={16}
        strokeWidth={2}
        aria-hidden
      />
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
  const tMentorship = useTranslations("mentorship");
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
        message:
          err instanceof ApiClientError
            ? err.body.message
            : tExam("save_error"),
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
      // The account is already gone, so a failed server logout leaves no live session
      // to worry about; the local session is cleared regardless. Don't block navigation.
      await logout().catch(() => undefined);
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
    <Card solid className="p-2 sm:p-2.5">
      <div className="px-2 pt-1 pb-1.5">
        <h2
          className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {tAccount("title")}
        </h2>
      </div>
      <div className="flex flex-col gap-0.5">
        <ListRow
          icon={<GraduationCap size={19} aria-hidden />}
          description={examSummary}
          onClick={() => void openExamSheet()}
        >
          {t("exam_label")}
        </ListRow>
        <ListRow
          icon={<CalendarDays size={19} aria-hidden />}
          description={joined}
          showChevron={false}
        >
          {t("member_since")}
        </ListRow>
        <ListRow
          href="/subscription"
          icon={<CreditCard size={18} aria-hidden />}
        >
          {tAccount("subscription")}
        </ListRow>
        {/* The only way into the mentorship flow. /my-coach answers both states on its own: no
            coach yet -> the invite-code screen, linked -> the data-scope contract. A student
            handed a code looks under "Koçum", so the row carries no separate hint. */}
        <ListRow href="/my-coach" icon={<UserRound size={18} aria-hidden />}>
          {tMentorship("my_coach_title")}
        </ListRow>
        {/* The other direction: becoming one. Always visible rather than gated on the flag —
            the screen behind it says "closed" for itself, and a row that appears and disappears
            with a config change is a row nobody can be told to look for. */}
        <ListRow
          href="/coach-application"
          icon={<GraduationCap size={19} aria-hidden />}
        >
          {tMentorship("application_title")}
        </ListRow>
        {/* The app has no footer (bottom nav owns that space), so this is the in-app way in. */}
        <ListRow
          href={{
            pathname: "/legal/[slug]",
            params: { slug: "kullanim-kosullari" },
          }}
          icon={<Scale size={18} aria-hidden />}
        >
          {tLegal("profile_section")}
        </ListRow>
        <ListRow
          icon={<LogOut size={18} aria-hidden />}
          onClick={() => {
            void logout().catch(() => {
              toast.error({ title: tAccount("logout_error"), duration: 3000 });
            });
          }}
          showChevron={false}
        >
          {tAccount("logout")}
        </ListRow>
        <ListRow
          danger
          icon={<Trash2 size={18} aria-hidden />}
          onClick={() => void deleteAccount()}
          showChevron={false}
        >
          {deleting ? t("delete_account.deleting") : t("delete_account.cta")}
        </ListRow>
      </div>
      {deleteError ? (
        <div className="mt-2 px-1">
          <FormError message={deleteError} />
        </div>
      ) : null}
    </Card>
  );
}
