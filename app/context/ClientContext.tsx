"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ClientInfo = {
  businessName: string;
  slug: string;
  mainDomain: string;
};

type ClientContextValue = {
  client: ClientInfo | null;
  setClient: (businessName: string, mainDomain?: string) => void;
  reset: () => void;
};

const ClientContext = createContext<ClientContextValue | null>(null);

function toSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  return cleaned || "client";
}

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [client, setClientState] = useState<ClientInfo | null>(null);

  const setClient = useCallback((businessName: string, mainDomain?: string) => {
    const trimmed = businessName.trim();
    if (!trimmed) return;
    const slug = toSlug(trimmed);
    const domain = (mainDomain?.trim() || `${slug}.com`).toLowerCase();
    const info: ClientInfo = { businessName: trimmed, slug, mainDomain: domain };
    setClientState(info);
  }, []);

  const reset = useCallback(() => {
    setClientState(null);
  }, []);

  const value = useMemo<ClientContextValue>(
    () => ({ client, setClient, reset }),
    [client, setClient, reset]
  );

  return (
    <ClientContext.Provider value={value}>{children}</ClientContext.Provider>
  );
}

export function useClient(): ClientContextValue {
  const ctx = useContext(ClientContext);
  if (!ctx) {
    throw new Error("useClient must be used inside <ClientProvider>");
  }
  return ctx;
}
