"use client";

import { useState, type ReactNode, type SVGProps } from "react";
import { useTranslations } from "next-intl";
import { Check, Link2 } from "lucide-react";

export function ShareRow({ title, url }: { title: string; url: string }) {
  const t = useTranslations("knowledge");
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(title);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked in some browsers; the control stays available.
    }
  }

  return (
    <section>
      <h2
        className="text-sm font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {t("share_title")}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ShareLink
          href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
          label={t("share_whatsapp")}
        >
          <WhatsAppIcon />
        </ShareLink>
        <ShareLink
          href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
          label={t("share_x")}
        >
          <XIcon />
        </ShareLink>
        <ShareLink
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          label={t("share_facebook")}
        >
          <FacebookIcon />
        </ShareLink>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? t("share_copied") : t("share_copy")}
          className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2"
          style={{
            borderColor: "color-mix(in srgb, var(--color-main) 16%, transparent)",
            color: "var(--color-main)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          {copied ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
        </button>
      </div>
    </section>
  );
}

function ShareLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2"
      style={{
        borderColor: "color-mix(in srgb, var(--color-main) 16%, transparent)",
        color: "var(--color-main)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      {children}
    </a>
  );
}

function iconProps(): SVGProps<SVGSVGElement> {
  return {
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    fill: "currentColor",
    "aria-hidden": true,
  };
}

function WhatsAppIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.93.52 3.76 1.43 5.33L2 22l4.98-1.53a10 10 0 0 0 5.06 1.36h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2m0 17.93h-.01a8.13 8.13 0 0 1-4.14-1.13l-.3-.18-2.95.9.9-2.88-.19-.3a8.1 8.1 0 0 1-1.27-4.4c0-4.48 3.67-8.12 8.18-8.12 4.36 0 8.18 3.64 8.18 8.12 0 4.48-3.67 8.12-8.18 8.12m4.48-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.37-1.94-1.2-.72-.64-1.2-1.42-1.34-1.66-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M14.72 10.47 22.4 2h-1.82l-6.66 7.35L8.6 2H2.2l8.05 11.22L2.2 22h1.82l7.04-7.77L15.4 22h6.4zm-2.49 2.75-.82-1.12L4.68 3.3h2.8l5.24 7.17.82 1.12 6.86 9.4h-2.8z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M22 12.07C22 6.5 17.52 2 12 2S2 6.5 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22c4.78-.75 8.43-4.91 8.43-9.93" />
    </svg>
  );
}
