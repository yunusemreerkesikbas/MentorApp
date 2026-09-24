"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function ShareCopyButton({
  url,
  label,
  copiedLabel,
  className,
}: {
  url: string;
  label: string;
  copiedLabel: string;
  className: string;
}) {
  const [copied, setCopied] = useState(false);

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
    <button type="button" onClick={handleCopy} aria-label={copied ? copiedLabel : label} className={className}>
      {copied ? <Check className="size-5" aria-hidden /> : <Link2 className="size-5" aria-hidden />}
    </button>
  );
}
