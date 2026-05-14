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

import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "ui-settings-v1";

type UiSettings = {
  isLocked: boolean;
};

type UiSettingsContextValue = {
  settings: UiSettings;
  updateSettings: (updates: Partial<UiSettings>) => void;
  toggleLock: () => void;
};

const UiSettingsContext = createContext<UiSettingsContextValue | null>(null);

export function UiSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<UiSettings>({ isLocked: false });

  useEffect(() => {
    // 1. Try local storage first for immediate feel
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettingsState(JSON.parse(raw));
      }
    } catch { /* ignore */ }

    // 2. Fetch from server for cross-browser persistence
    (async () => {
      try {
        const res = await apiFetch("/api/dashboard/closing-meeting/order?type=settings");
        const json = await res.json();
        if (json.success && json.data) {
          setSettingsState(json.data);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(json.data));
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.error("Failed to fetch UI settings", e);
      }
    })();
  }, []);

  const updateSettings = useCallback((updates: Partial<UiSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates };
      
      // Update local storage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }

      // Update server
      apiFetch("/api/dashboard/closing-meeting/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "settings", data: next }),
      }).catch((e) => console.error("Failed to save UI settings", e));

      return next;
    });
  }, []);

  const toggleLock = useCallback(() => {
    updateSettings({ isLocked: !settings.isLocked });
  }, [settings.isLocked, updateSettings]);

  const value = useMemo(
    () => ({ settings, updateSettings, toggleLock }),
    [settings, updateSettings, toggleLock]
  );

  return (
    <UiSettingsContext.Provider value={value}>
      {children}
    </UiSettingsContext.Provider>
  );
}

export function useUiSettings() {
  const ctx = useContext(UiSettingsContext);
  if (!ctx) {
    throw new Error("useUiSettings must be used within UiSettingsProvider");
  }
  return ctx;
}
