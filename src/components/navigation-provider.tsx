"use client";

import { useLinkStatus } from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { SiteLoader } from "@/components/site-loader";

const NavigationContext = createContext<(() => () => void) | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [pendingLinks, setPendingLinks] = useState(0);
  const beginNavigation = useCallback(() => {
    setPendingLinks((count) => count + 1);
    return () => setPendingLinks((count) => count - 1);
  }, []);
  const pending = pendingLinks > 0;

  return (
    <NavigationContext.Provider value={beginNavigation}>
      <div inert={pending} aria-busy={pending}>
        {children}
      </div>
      {pending && <SiteLoader />}
    </NavigationContext.Provider>
  );
}

// Read Next.js's own link state so cached links, modifier clicks, cancelled
// transitions and external links keep their normal navigation behavior.
export function NavigationPending() {
  const { pending } = useLinkStatus();
  const beginNavigation = useContext(NavigationContext);

  useEffect(() => {
    if (pending && beginNavigation) return beginNavigation();
  }, [pending, beginNavigation]);

  return null;
}
