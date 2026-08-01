"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiClientError } from "@mentor/api-client";
import type {
  CoachConversationDto,
  CoachConversationOriginDto,
  ForumCoachBridgeView,
} from "@mentor/types";
import {
  deleteCoachConversation,
  listCoachConversations,
  listCoachMessages,
} from "@/lib/coach";
import type { ChatMessage } from "./coach-transcript";

const HISTORY_PAGE_SIZE = 30;
const CONVERSATION_PAGE_SIZE = 20;

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface CoachSessionContextValue {
  messages: ChatMessage[];
  conversations: CoachConversationDto[];
  activeConversationId: string | null;
  conversationOrigin: CoachConversationOriginDto | null;
  communitySource: ForumCoachBridgeView | null;
  conversationStatus: LoadStatus;
  conversationError: string | null;
  historyStatus: LoadStatus;
  historyError: string | null;
  hasOlderMessages: boolean;
  loadingOlderMessages: boolean;
  olderMessagesError: string | true | null;
  appendMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  openConversation: (id: string) => Promise<void>;
  retryConversationHistory: () => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  startNewChat: () => void;
  adoptConversation: (id: string) => void;
  setCommunityContext: (
    origin: CoachConversationOriginDto | null,
    source: ForumCoachBridgeView | null,
  ) => void;
  refreshConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

const CoachSessionContext = createContext<CoachSessionContextValue | null>(
  null,
);

/**
 * Re-provide session into portaled UI (bottom sheet children render under the root
 * BottomSheetProvider, outside CoachSessionProvider in the React tree).
 */
export function CoachSessionPortal({
  value,
  children,
}: {
  value: CoachSessionContextValue;
  children: ReactNode;
}) {
  return (
    <CoachSessionContext.Provider value={value}>
      {children}
    </CoachSessionContext.Provider>
  );
}

function toChatMessages(
  items: Awaited<ReturnType<typeof listCoachMessages>>["items"],
) {
  return [...items].reverse().map((m) => ({
    id: m.id,
    role: m.role === "USER" ? ("user" as const) : ("coach" as const),
    text: m.content,
    sources: m.sources,
    feedback: m.feedback,
    suggestedTask: m.suggestedTask,
    officialCountdown: m.officialCountdown,
  }));
}

function errorMessage(error: unknown): string | null {
  return error instanceof ApiClientError ? error.body.message : null;
}

export function CoachSessionProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<CoachConversationDto[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [conversationOrigin, setConversationOrigin] =
    useState<CoachConversationOriginDto | null>(null);
  const [communitySource, setCommunitySource] =
    useState<ForumCoachBridgeView | null>(null);
  const [conversationStatus, setConversationStatus] =
    useState<LoadStatus>("idle");
  const [conversationError, setConversationError] = useState<string | null>(
    null,
  );
  const [historyStatus, setHistoryStatus] = useState<LoadStatus>("idle");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [olderMessagesError, setOlderMessagesError] = useState<string | true | null>(
    null,
  );
  const conversationRequestRef = useRef(0);
  const historyRequestRef = useRef(0);

  const refreshConversations = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++conversationRequestRef.current;
    setConversationStatus("loading");
    setConversationError(null);
    try {
      const { items } = await listCoachConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      if (requestId !== conversationRequestRef.current) return;
      setConversations(items);
      setConversationStatus("ready");
    } catch (error) {
      if (requestId !== conversationRequestRef.current) return;
      setConversationError(errorMessage(error));
      setConversationStatus("error");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const requestId = ++conversationRequestRef.current;
    listCoachConversations(1, CONVERSATION_PAGE_SIZE)
      .then(({ items }) => {
        if (!active || requestId !== conversationRequestRef.current) return;
        setConversations(items);
        setConversationStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active || requestId !== conversationRequestRef.current) return;
        setConversationError(errorMessage(error));
        setConversationStatus("error");
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const openConversation = useCallback(
    async (id: string) => {
      const requestId = ++historyRequestRef.current;
      setActiveConversationId(id);
      setConversationOrigin(null);
      setCommunitySource(null);
      setMessagesState([]);
      setHistoryStatus("loading");
      setHistoryError(null);
      setHistoryPage(0);
      setHistoryTotal(0);
      setLoadingOlderMessages(false);
      setOlderMessagesError(null);
      try {
        const result = await listCoachMessages(id, 1, HISTORY_PAGE_SIZE);
        if (requestId !== historyRequestRef.current) return;
        setMessagesState(toChatMessages(result.items));
        setConversationOrigin(result.origin);
        setCommunitySource(result.communitySource);
        setHistoryPage(1);
        setHistoryTotal(result.total);
        setHistoryStatus("ready");
      } catch (error) {
        if (requestId !== historyRequestRef.current) return;
        setHistoryError(errorMessage(error));
        setHistoryStatus("error");
      }
    },
    [],
  );

  const retryConversationHistory = useCallback(async () => {
    if (activeConversationId) {
      await openConversation(activeConversationId);
    }
  }, [activeConversationId, openConversation]);

  const loadOlderMessages = useCallback(async () => {
    if (
      !activeConversationId ||
      historyStatus !== "ready" ||
      loadingOlderMessages ||
      historyPage * HISTORY_PAGE_SIZE >= historyTotal
    ) {
      return;
    }

    const requestId = historyRequestRef.current;
    const nextPage = historyPage + 1;
    setLoadingOlderMessages(true);
    setOlderMessagesError(null);
    try {
      const result = await listCoachMessages(
        activeConversationId,
        nextPage,
        HISTORY_PAGE_SIZE,
      );
      if (requestId !== historyRequestRef.current) return;
      const older = toChatMessages(result.items);
      setMessagesState((current) => {
        const currentIds = new Set(current.map((message) => message.id));
        return [
          ...older.filter((message) => !currentIds.has(message.id)),
          ...current,
        ];
      });
      setHistoryPage(nextPage);
      setHistoryTotal(result.total);
    } catch (error) {
      if (requestId !== historyRequestRef.current) return;
      setOlderMessagesError(errorMessage(error) ?? true);
    } finally {
      if (requestId === historyRequestRef.current) {
        setLoadingOlderMessages(false);
      }
    }
  }, [
    activeConversationId,
    historyPage,
    historyStatus,
    historyTotal,
    loadingOlderMessages,
  ]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessagesState((current) => [...current, message]);
  }, []);

  const updateMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessagesState((current) =>
        current.map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      );
    },
    [],
  );

  const removeMessage = useCallback((id: string) => {
    setMessagesState((current) =>
      current.filter((message) => message.id !== id),
    );
  }, []);

  const startNewChat = useCallback(() => {
    historyRequestRef.current += 1;
    setMessagesState([]);
    setActiveConversationId(null);
    setConversationOrigin(null);
    setCommunitySource(null);
    setHistoryStatus("idle");
    setHistoryError(null);
    setHistoryPage(0);
    setHistoryTotal(0);
    setLoadingOlderMessages(false);
    setOlderMessagesError(null);
  }, []);

  const adoptConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setHistoryStatus("ready");
  }, []);

  const setCommunityContext = useCallback(
    (origin: CoachConversationOriginDto | null, source: ForumCoachBridgeView | null) => {
      setConversationOrigin(origin);
      setCommunitySource(source);
    },
    [],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await deleteCoachConversation(id);
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== id),
      );
      if (activeConversationId === id) startNewChat();
    },
    [activeConversationId, startNewChat],
  );

  const value = useMemo(
    () => ({
      messages,
      conversations,
      activeConversationId,
      conversationOrigin,
      communitySource,
      conversationStatus,
      conversationError,
      historyStatus,
      historyError,
      hasOlderMessages: historyPage * HISTORY_PAGE_SIZE < historyTotal,
      loadingOlderMessages,
      olderMessagesError,
      appendMessage,
      updateMessage,
      removeMessage,
      openConversation,
      retryConversationHistory,
      loadOlderMessages,
      startNewChat,
      adoptConversation,
      setCommunityContext,
      refreshConversations,
      deleteConversation,
    }),
    [
      messages,
      conversations,
      activeConversationId,
      conversationOrigin,
      communitySource,
      conversationStatus,
      conversationError,
      historyStatus,
      historyError,
      historyPage,
      historyTotal,
      loadingOlderMessages,
      olderMessagesError,
      appendMessage,
      updateMessage,
      removeMessage,
      openConversation,
      retryConversationHistory,
      loadOlderMessages,
      startNewChat,
      adoptConversation,
      setCommunityContext,
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
  const context = useContext(CoachSessionContext);
  if (!context) {
    throw new Error("useCoachSession must be used within CoachSessionProvider");
  }
  return context;
}
