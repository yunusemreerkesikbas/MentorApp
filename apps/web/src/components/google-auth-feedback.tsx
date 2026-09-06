"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FormError } from "@/components/form";

/** OAuth redirects carry a safe, localized backend message; never display provider diagnostics. */
export function GoogleAuthFeedback() {
  return <Suspense fallback={null}><GoogleAuthMessage /></Suspense>;
}

function GoogleAuthMessage() {
  const params = useSearchParams();
  return <FormError message={params.get("googleError")?.slice(0, 500) ?? null} />;
}
