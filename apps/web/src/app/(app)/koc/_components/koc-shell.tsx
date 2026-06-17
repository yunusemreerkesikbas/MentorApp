"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SubscriptionView } from "@mentor/types";
import { ApiClientError, subscriptionsControllerGetMine } from "@mentor/api-client";
import { FormError } from "../../../../components/form";
import { sendCoachMessage } from "../../../../lib/coach";
import { CoachComposer } from "./coach-composer";
import { CoachTranscript, type ChatMessage } from "./coach-transcript";
import { PremiumUpsell } from "./premium-upsell";

type LoadState = "loading" | "premium" | "free" | "error";

const newId = () => globalThis.crypto.randomUUID();

/**
 * /koc shell: gates on premium entitlement (free → upsell), then drives an ephemeral single-turn
 * chat. Each send hits the stateless backend; the transcript lives only in client state.
 */
export function KocShell() {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    subscriptionsControllerGetMine()
      .then((v) => {
        if (!active) return;
        const ent = (v as unknown as SubscriptionView).entitlement;
        setState(ent?.isPremium ? "premium" : "free");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState("error");
        setLoadError(err instanceof Error ? err.message : "Bir hata oluştu.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setChatError(null);
    setInput("");
    setMessages((m) => [...m, { id: newId(), role: "user", text: trimmed }]);
    setBusy(true);
    try {
      const { reply } = await sendCoachMessage(trimmed);
      setMessages((m) => [...m, { id: newId(), role: "coach", text: reply }]);
    } catch (err) {
      setChatError(err instanceof ApiClientError ? err.body.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
      composerRef.current?.focus();
    }
  }

  function pickSuggestion(text: string) {
    setInput(text);
    composerRef.current?.focus();
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <FormError message={loadError} />
      </main>
    );
  }

  if (state === "free") return <PremiumUpsell />;

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
      };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col lg:min-h-screen">
      <motion.header className="px-5 pt-8" {...headerMotion}>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Sınav Koçu
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
          Yalnız değilsin — sor, planla, motive ol.
        </p>
      </motion.header>
      <CoachTranscript
        messages={messages}
        busy={busy}
        error={chatError}
        onPickSuggestion={pickSuggestion}
      />
      <CoachComposer
        ref={composerRef}
        value={input}
        onChange={setInput}
        onSend={() => void send(input)}
        busy={busy}
      />
    </main>
  );
}
