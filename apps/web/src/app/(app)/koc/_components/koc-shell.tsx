"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CoachAccessMode, type CoachAccessDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "../../../../components/form";
import { fetchCoachAccess, sendCoachMessage } from "../../../../lib/coach";
import { CoachAccessGate } from "./coach-access-gate";
import { CoachComposer } from "./coach-composer";
import { CoachTranscript, type ChatMessage } from "./coach-transcript";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "gate"; access: CoachAccessDto }
  | { status: "chat"; access: CoachAccessDto };

const newId = () => globalThis.crypto.randomUUID();

/**
 * /koc shell: premium flat or earned-coin path (via GET /coach/access), then ephemeral chat.
 * Coin is never shown in the composer or transcript (§4 #3).
 */
export function KocShell() {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    fetchCoachAccess()
      .then((access) => {
        if (!active) return;
        setState(
          access.canChat
            ? { status: "chat", access }
            : { status: "gate", access },
        );
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Bir hata oluştu.",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || state.status !== "chat") return;
    setChatError(null);
    setInput("");
    const clientMessageId = newId();
    setMessages((m) => [...m, { id: clientMessageId, role: "user", text: trimmed }]);
    setBusy(true);
    try {
      const { reply, sources } = await sendCoachMessage(trimmed, clientMessageId);
      setMessages((m) => [...m, { id: newId(), role: "coach", text: reply, sources }]);
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

  if (state.status === "loading") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <FormError message={state.message} />
      </main>
    );
  }

  if (state.status === "gate") {
    return <CoachAccessGate access={state.access} />;
  }

  const subtitle =
    state.access.mode === CoachAccessMode.COIN
      ? "Kazanılmış hakla koçunla sohbet ediyorsun."
      : "Yalnız değilsin — sor, planla, motive ol.";

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
          {subtitle}
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
