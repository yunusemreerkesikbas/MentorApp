"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "@/components/form";

export function ThreadComposer({
  placeholder,
  submitLabel,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
}) {
  const t = useTranslations("topluluk");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const body = value.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body);
      setValue("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex flex-col gap-2 py-4 pl-3 pr-4">
      <div className="flex items-start gap-3">
        {/* Generic viewer avatar — decorative placeholder, no current-user fetch */}
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(0,0,0,0.06)" }}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            maxLength={4000}
            className="w-full resize-none border-0 bg-transparent text-[15px] leading-[22px] outline-none placeholder:font-medium placeholder:text-[color:var(--color-secondary)]"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {value.length > 0 ? `${value.length}/4000` : <span className="opacity-0">0</span>}
            </span>
            <button
              type="button"
              aria-label={submitLabel}
              disabled={busy || !value.trim()}
              onClick={() => void send()}
              className="flex cursor-pointer items-center justify-center rounded-full transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              style={{
                width: 36,
                height: 36,
                background: value.trim() ? "var(--color-btn)" : "rgba(0,0,0,0.06)",
                color: value.trim() ? "#fff" : "var(--color-secondary)",
              }}
            >
              {busy ? (
                <span className="text-[10px] font-semibold">{t("compose_sending")}</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      <FormError message={error} />
    </div>
  );
}
