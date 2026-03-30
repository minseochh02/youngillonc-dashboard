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

const STORAGE_KEY = "dashboard-include-vat";

type VatIncludeContextValue = {
  includeVat: boolean;
  setIncludeVat: (value: boolean) => void;
  toggleIncludeVat: () => void;
};

const VatIncludeContext = createContext<VatIncludeContextValue | null>(null);

export function VatIncludeProvider({ children }: { children: ReactNode }) {
  const [includeVat, setIncludeVatState] = useState(false);

  useEffect(() => {
    try {
      setIncludeVatState(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const setIncludeVat = useCallback((value: boolean) => {
    setIncludeVatState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleIncludeVat = useCallback(() => {
    setIncludeVat(!includeVat);
  }, [includeVat, setIncludeVat]);

  const value = useMemo(
    () => ({ includeVat, setIncludeVat, toggleIncludeVat }),
    [includeVat, setIncludeVat, toggleIncludeVat]
  );

  return (
    <VatIncludeContext.Provider value={value}>
      {children}
    </VatIncludeContext.Provider>
  );
}

export function useVatInclude() {
  const ctx = useContext(VatIncludeContext);
  if (!ctx) {
    throw new Error("useVatInclude must be used within VatIncludeProvider");
  }
  return ctx;
}
