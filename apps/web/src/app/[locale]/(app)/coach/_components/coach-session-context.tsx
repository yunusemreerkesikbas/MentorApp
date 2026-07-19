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
import type { CoachConversationDto } from "@mentor/types";
import {
  deleteCoachConversation,
  listCoachConversations,
  listCoachMessages,
} from "@/lib/coach";
import type { ChatMessage } from "./coach-transcript";

/** How many persisted messages to hydrate into the transcript when a thread opens. */
const HISTORY_PAGE_SIZE = 30;
/** How many threads the hub list shows. */
const CONVERSATION_PAGE_SIZE = 20;

interface CoachSessionContextValue {
  /** Messages of the active thread (empty for a brand-new chat). */
  messages: ChatMessage[];
  /** The user's threads, most-recently-active first. */
  conversations: CoachConversationDto[];
  /** Active thread; null means "new chat" (created on the first reply). */
  activeConversationId: string | null;
  hydrated: boolean;
  appendMessage: (message: ChatMessage) => void;
  /** Patch a message in place (streaming deltas grow the coach bubble). */
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  /** Drop a message (e.g. an empty streaming placeholder after a failure). */
  removeMessage: (id: string) => void;
  /** Load a thread's history and make it active. */
  openConversation: (id: string) => Promise<void>;
  /** Start a fresh thread — deletes nothing; the backend creates it on the first reply. */
  startNewChat: () => void;
  /** Adopt the thread id the backend returned for the first message of a new chat. */
  adoptConversation: (id: string) => void;
  /** Refresh the thread list (after a first message or a delete). */
  refreshConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

const CoachSessionContext = createContext<CoachSessionContextValue | null>(
  null,
);

function toChatMessages(items: Awaited<ReturnType<typeof listCoachMessages>>["items"]) {
  // API returns newest-first; the transcript renders oldest-first.
  return [...items].reverse().map((m) => ({
    id: m.id,
    role: m.role === "USER" ? ("user" as const) : ("coach" as const),
    text: m.content,
    sources: m.sources,
    feedback: m.feedback,
    suggestedTask: m.suggestedTask,
  }));
}

export function CoachSessionProvider({ children }: { children: ReactNode }) {
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<CoachConversationDto[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refreshConversations = useCallback(async () => {
    try {
      const { items } = await listCoachConversations(1, CONVERSATION_PAGE_SIZE);
      setConversations(items);
    } catch {
      // Thread list unavailable (offline, ai.enabled off) — chat still works.
    }
  }, []);

  useEffect(() => {
    let active = true;
    listCoachConversations(1, CONVERSATION_PAGE_SIZE)
      .then(({ items }) => {
        if (active) setConversations(items);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    try {
      const { items } = await listCoachMessages(id, 1, HISTORY_PAGE_SIZE);
      setMessagesState(toChatMessages(items));
    } catch {
      // History unavailable — the thread opens with a blank transcript rather than failing.
      setMessagesState([]);
    }
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

  const startNewChat = useCallback(() => {
    setMessagesState([]);
    setActiveConversationId(null);
  }, []);

  const adoptConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await deleteCoachConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // Deleting the open thread drops you back into a fresh chat.
      setActiveConversationId((current) => {
        if (current !== id) return current;
        setMessagesState([]);
        return null;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      messages,
      conversations,
      activeConversationId,
      hydrated,
      appendMessage,
      updateMessage,
      removeMessage,
      openConversation,
      startNewChat,
      adoptConversation,
      refreshConversations,
      deleteConversation,
    }),
    [
      messages,
      conversations,
      activeConversationId,
      hydrated,
      appendMessage,
      updateMessage,
      removeMessage,
      openConversation,
      startNewChat,
      adoptConversation,
      refreshConversations,
      deleteConversation,
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
