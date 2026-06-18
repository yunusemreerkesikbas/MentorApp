"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { authControllerVerifyEmail } from "@mentor/api-client";
import { SectionHeading } from "@mentor/ui";
import { FormError, FormSuccess } from "../../../components/form";
import { AuthNavLink } from "../_components/auth-nav-link";

function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [error, setError] = useState<string | null>(null);
  const missingToken = token === "";

  useEffect(() => {
    if (!token) return;
    let active = true;
    authControllerVerifyEmail({ token })
      .then(() => {
        if (active) setState("ok");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState("error");
        setError(err instanceof Error ? err.message : "Bir hata oluştu.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading as="h2">E-posta doğrulama</SectionHeading>
      {missingToken ? (
        <FormError message="Geçersiz bağlantı. Lütfen e-postandaki bağlantıyı kullan." />
      ) : (
        <>
          {state === "pending" && (
            <p style={{ color: "var(--color-secondary)" }}>Doğrulanıyor…</p>
          )}
          {state === "ok" && <FormSuccess message="E-postan doğrulandı. Hoş geldin!" />}
          {state === "error" && <FormError message={error} />}
        </>
      )}
      <AuthNavLink href="/giris">Girişe dön</AuthNavLink>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
