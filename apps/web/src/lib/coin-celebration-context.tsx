"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { COIN_CELEBRATE_EVENT, type CoinCelebrateDetail } from "@/lib/economy";
import { CoinCelebration } from "@/components/coin-celebration";

interface CoinCelebrationContextValue {
  triggerCoinCelebration: (amount: number, label?: string) => void;
}

const CoinCelebrationContext = createContext<CoinCelebrationContextValue | null>(null);

interface ActiveCelebration extends CoinCelebrateDetail {
  id: number;
}

export function CoinCelebrationProvider({ children }: { children: ReactNode }) {
  const [activeItem, setActiveItem] = useState<ActiveCelebration | null>(null);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAmountRef = useRef(0);
  const pendingLabelRef = useRef<string | undefined>(undefined);

  const flushBatch = useCallback(() => {
    if (pendingAmountRef.current <= 0) return;
    const amount = pendingAmountRef.current;
    const label = pendingLabelRef.current;
    pendingAmountRef.current = 0;
    pendingLabelRef.current = undefined;

    setActiveItem((current) => {
      // Accumulate if one is currently in view
      if (current) {
        return {
          id: current.id,
          amount: current.amount + amount,
          label: label ?? current.label,
        };
      }
      return { id: Date.now(), amount, label };
    });
  }, []);

  const triggerCoinCelebration = useCallback(
    (amount: number, label?: string) => {
      if (amount <= 0) return;
      pendingAmountRef.current += amount;
      if (label) pendingLabelRef.current = label;

      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      // Batch window (60ms) gathers simultaneous multi-quest finishes into a single celebration
      batchTimeoutRef.current = setTimeout(() => {
        flushBatch();
        batchTimeoutRef.current = null;
      }, 60);
    },
    [flushBatch],
  );

  useEffect(() => {
    function handleEvent(event: Event) {
      const customEvent = event as CustomEvent<CoinCelebrateDetail>;
      if (customEvent.detail && typeof customEvent.detail.amount === "number") {
        triggerCoinCelebration(customEvent.detail.amount, customEvent.detail.label);
      }
    }

    window.addEventListener(COIN_CELEBRATE_EVENT, handleEvent);

    // Dev/QA helper: check for ?mockCoinCelebration=5 in URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mockAmount = params.get("mockCoinCelebration");
      if (mockAmount) {
        const parsed = parseInt(mockAmount, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          triggerCoinCelebration(parsed);
        }
      }
    }

    return () => {
      window.removeEventListener(COIN_CELEBRATE_EVENT, handleEvent);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    };
  }, [triggerCoinCelebration]);

  const handleClose = useCallback(() => {
    setActiveItem(null);
  }, []);

  return (
    <CoinCelebrationContext.Provider value={{ triggerCoinCelebration }}>
      {children}
      {activeItem ? (
        <CoinCelebration
          key={activeItem.id}
          amount={activeItem.amount}
          label={activeItem.label}
          onClose={handleClose}
        />
      ) : null}
    </CoinCelebrationContext.Provider>
  );
}

export function useCoinCelebration(): CoinCelebrationContextValue {
  const ctx = useContext(CoinCelebrationContext);
  if (!ctx) {
    // Graceful fallback for components outside provider: dispatches custom DOM event
    return {
      triggerCoinCelebration: (amount: number, label?: string) => {
        if (typeof window !== "undefined" && amount > 0) {
          window.dispatchEvent(
            new CustomEvent<CoinCelebrateDetail>(COIN_CELEBRATE_EVENT, {
              detail: { amount, label },
            }),
          );
        }
      },
    };
  }
  return ctx;
}
