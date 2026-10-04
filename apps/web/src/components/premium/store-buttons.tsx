import { useTranslations } from "next-intl";
import type { StoreLinks } from "@/lib/purchase-mode";

// ponytail: mirrors @mentor/ui Button's primary look on an <a>, because Button renders a <button> and
// a store hand-off must stay a real link. Move to a ButtonLink in @mentor/ui when a second one appears.
const STORE_LINK_CLASS =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-card)] border px-4 py-2.5 text-sm font-semibold shadow-[var(--shadow-card)] outline-none transition-[opacity,box-shadow,transform] duration-150 hover:opacity-90 hover:shadow-[var(--shadow-card-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";

interface StoreButtonsProps {
  links: StoreLinks;
}

/**
 * The web's hand-off to App Store / Google Play while it cannot sell a plan itself. Text links, not
 * the official badge artwork. A store without a configured URL is simply not offered.
 */
export function StoreButtons({ links }: StoreButtonsProps) {
  const t = useTranslations("subscription");
  const stores = [
    { href: links.appStore, label: t("store_app_store") },
    { href: links.playStore, label: t("store_play_store") },
  ].filter((store): store is { href: string; label: string } => store.href !== null);

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row">
      {stores.map((store) => (
        <a
          key={store.href}
          href={store.href}
          target="_blank"
          rel="noopener noreferrer"
          className={STORE_LINK_CLASS}
          style={{
            backgroundColor: "var(--color-btn)",
            color: "var(--color-btn-label)",
            borderColor: "var(--color-btn)",
            fontFamily: "var(--font-body)",
          }}
        >
          {store.label}
        </a>
      ))}
    </div>
  );
}
