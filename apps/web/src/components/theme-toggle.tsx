"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTheme } from "@/lib/use-theme";

/**
 * Light/dark toggle for the desktop sidebar footer.
 * Cookie + `html.dark` — no system-preference follow in this slice.
 */
export function ThemeToggle() {
  const t = useTranslations("nav");
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t("theme_to_light") : t("theme_to_dark")}
      aria-pressed={isDark}
      title={t("theme_toggle_label")}
      className="grid size-11 cursor-pointer place-items-center rounded-[var(--radius-card)] text-[var(--color-main)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
    >
      {isDark ? (
        <Sun size={20} strokeWidth={2.15} aria-hidden />
      ) : (
        <Moon size={20} strokeWidth={2.15} aria-hidden />
      )}
    </button>
  );
}
