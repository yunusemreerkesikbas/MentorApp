import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/ui/text.js";
import { cardShadow, tabBarClearance } from "../lib/layout.js";
import { useThemeTokens } from "./theme-provider.js";

const TOAST_MS = 2600;

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * The app's one-line notice: a short strip above the tab bar that leaves on its own. Everyday
 * rewards (XP, the daily Coin) land here; the ones worth stopping for get a full scene instead.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { palette } = useThemeTokens();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(() => setMessage(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const show = useCallback((next: string) => setMessage(next), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={[
            styles.toast,
            cardShadow,
            {
              bottom: tabBarClearance(insets.bottom) - 4,
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          <AppText style={styles.text}>{message}</AppText>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within <ToastProvider>");
  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
