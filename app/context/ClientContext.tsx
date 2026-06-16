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
  firstName: string;
  lastName: string;
};

export type SetClientInput = {
  businessName: string;
  mainDomain?: string;
  firstName?: string;
  lastName?: string;
};

type ClientContextValue = {
  client: ClientInfo;
  setClient: (input: SetClientInput) => void;
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

/**
 * The walkthrough opens straight on the infrastructure (no input gate), so the
 * client starts as a clean placeholder persona. The company name is editable
 * live from the top nav, which keeps it usable on a sales call without a form.
 */
const DEFAULT_CLIENT: ClientInfo = {
  businessName: "Acme",
  slug: "acme",
  mainDomain: "acme.com",
  firstName: "Jordan",
  lastName: "Avery",
};

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [client, setClientState] = useState<ClientInfo>(DEFAULT_CLIENT);

  const setClient = useCallback((input: SetClientInput) => {
    const trimmed = input.businessName.trim();
    if (!trimmed) return;
    const slug = toSlug(trimmed);
    const domain = (input.mainDomain?.trim() || `${slug}.com`).toLowerCase();
    setClientState((prev) => ({
      businessName: trimmed,
      slug,
      mainDomain: domain,
      // Editing the company alone preserves the existing sender persona.
      firstName: input.firstName?.trim() ?? prev.firstName,
      lastName: input.lastName?.trim() ?? prev.lastName,
    }));
  }, []);

  const reset = useCallback(() => {
    setClientState(DEFAULT_CLIENT);
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
