"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearCoachHistory, listCoachMessages } from "@/lib/coach";
import type { ChatMessage } from "./coach-transcript";
import {
  loadRecentTopics,
  MAX_RECENT_TOPICS,
  saveRecentTopics,
} from "./coach-session-storage";

/** How many persisted messages to hydrate into the transcript on open. */
const HISTORY_PAGE_SIZE = 30;

interface CoachSessionContextValue {
  messages: ChatMessage[];
  recentTopics: string[];
  hasActiveChat: boolean;
  hydrated: boolean;
  appendMessage: (message: ChatMessage) => void;
  /** Patch a message in place (streaming deltas grow the coach bubble). */
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  /** Drop a message (e.g. an empty streaming placeholder after a failure). */
  removeMessage: (id: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  pushRecentTopic: (label: string) => void;
  startNewChat: () => void;
}

const CoachSessionContext = createContext<CoachSessionContextValue | null>(
  null,
);

export function CoachSessionProvider({ children }: { children: ReactNode }) {
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const [recentTopics, setRecentTopics] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate after mount (topics + API history) */
    setRecentTopics(loadRecentTopics());
    listCoachMessages(1, HISTORY_PAGE_SIZE)
      .then(({ items }) => {
        if (!active) return;
        // API returns newest-first; the transcript renders oldest-first.
        setMessagesState(
          [...items].reverse().map((m) => ({
            id: m.id,
            role: m.role === "USER" ? ("user" as const) : ("coach" as const),
            text: m.content,
            sources: m.sources,
          })),
        );
      })
      .catch(() => {
        // History unavailable (offline, ai.enabled off) — chat still works from a blank transcript.
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveRecentTopics(recentTopics);
  }, [recentTopics, hydrated]);

  const setMessages = useCallback((next: ChatMessage[]) => {
    setMessagesState(next);
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessagesState((prev) => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessagesState((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessagesState((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const pushRecentTopic = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setRecentTopics((prev) => {
      const without = prev.filter(
        (t) => t.toLowerCase() !== trimmed.toLowerCase(),
      );
      return [trimmed, ...without].slice(0, MAX_RECENT_TOPICS);
    });
  }, []);

  const startNewChat = useCallback(() => {
    setMessagesState([]);
    // Best-effort: if the DELETE fails the history simply reappears on next open.
    void clearCoachHistory().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      messages,
      recentTopics,
      hasActiveChat: messages.length > 0,
      hydrated,
      appendMessage,
      updateMessage,
      removeMessage,
      setMessages,
      pushRecentTopic,
      startNewChat,
    }),
    [
      messages,
      recentTopics,
      hydrated,
      appendMessage,
      updateMessage,
      removeMessage,
      setMessages,
      pushRecentTopic,
      startNewChat,
    ],
  );

  return (
    <CoachSessionContext.Provider value={value}>
      {children}
    </CoachSessionContext.Provider>
  );
}

export function useCoachSession(): CoachSessionContextValue {
  const ctx = useContext(CoachSessionContext);
  if (!ctx) {
    throw new Error("useCoachSession must be used within CoachSessionProvider");
  }
  return ctx;
}
