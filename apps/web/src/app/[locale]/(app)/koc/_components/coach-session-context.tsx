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
import type { ChatMessage } from "./coach-transcript";
import {
  clearCoachMessages,
  loadCoachSession,
  MAX_RECENT_TOPICS,
  saveCoachSession,
} from "./coach-session-storage";

interface CoachSessionContextValue {
  messages: ChatMessage[];
  recentTopics: string[];
  hasActiveChat: boolean;
  hydrated: boolean;
  appendMessage: (message: ChatMessage) => void;
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
    const stored = loadCoachSession();
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage hydrate after mount */
    setMessagesState(stored.messages);
    setRecentTopics(stored.recentTopics);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCoachSession({ messages, recentTopics });
  }, [messages, recentTopics, hydrated]);

  const setMessages = useCallback((next: ChatMessage[]) => {
    setMessagesState(next);
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessagesState((prev) => [...prev, message]);
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
    clearCoachMessages();
  }, []);

  const value = useMemo(
    () => ({
      messages,
      recentTopics,
      hasActiveChat: messages.length > 0,
      hydrated,
      appendMessage,
      setMessages,
      pushRecentTopic,
      startNewChat,
    }),
    [
      messages,
      recentTopics,
      hydrated,
      appendMessage,
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
