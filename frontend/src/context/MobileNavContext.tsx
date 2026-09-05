"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface MobileNavContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

/** Tracks whether the off-canvas sidebar drawer is open on small screens. */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MobileNavContext.Provider value={{ open, setOpen }}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within MobileNavProvider");
  return ctx;
}
