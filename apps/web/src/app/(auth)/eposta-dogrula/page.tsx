"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { authControllerVerifyEmail } from "@mentor/api-client";
import { FormError, FormSuccess } from "../../../components/form";

function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [error, setError] = useState<string | null>(null);
  // Missing token is derived during render — no state needed (react-compiler rule).
  const missingToken = token === "";

  useEffect(() => {
    if (!token) return;
    authControllerVerifyEmail({ token })
      .then(() => setState("ok"))
      .catch((err: unknown) => {
        setState("error");
        setError(err instanceof Error ? err.message : "Bir hata oluştu.");
      });
  }, [token]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold" style={{ color: "var(--color-main)" }}>
        E-posta doğrulama
      </h2>
      {missingToken ? (
        <FormError message="Geçersiz bağlantı. Lütfen e-postandaki bağlantıyı kullan." />
      ) : (
        <>
          {state === "pending" && (
            <p style={{ color: "var(--color-secondary)" }}>Doğrulanıyor…</p>
          )}
          {state === "ok" && <FormSuccess message="E-postan doğrulandı. Hoş geldin! 🎉" />}
          {state === "error" && <FormError message={error} />}
        </>
      )}
      <Link href="/giris" className="text-sm underline" style={{ color: "var(--color-secondary)" }}>
        Girişe dön
      </Link>
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
