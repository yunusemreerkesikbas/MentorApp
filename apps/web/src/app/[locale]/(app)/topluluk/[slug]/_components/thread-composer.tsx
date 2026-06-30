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
  const [focused, setFocused] = useState(false);

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
    <div className="flex flex-col gap-2">
      <div
        className="overflow-hidden rounded-xl bg-white transition-shadow duration-200"
        style={{
          boxShadow: focused
            ? "0 0 0 2px var(--color-focus-ring), var(--shadow-card)"
            : "var(--shadow-card)",
        }}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={3}
          maxLength={4000}
          className="w-full resize-none border-0 bg-transparent px-4 pt-4 pb-2 text-sm outline-none"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
        />
        {/* Bottom toolbar */}
        <div
          className="flex items-center justify-between border-t px-4 py-2"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {value.length > 0 ? `${value.length}/4000` : <span className="opacity-0">0</span>}
          </span>
          <button
            type="button"
            disabled={busy || !value.trim()}
            onClick={() => void send()}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            style={{
              background: "var(--color-btn)",
              color: "#fff",
              fontFamily: "var(--font-body)",
            }}
          >
            {busy ? (
              t("compose_sending")
            ) : (
              <>
                {submitLabel}
                {/* send arrow */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
      <FormError message={error} />
    </div>
  );
}
