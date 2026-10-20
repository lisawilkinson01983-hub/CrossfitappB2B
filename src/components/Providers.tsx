"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { NavDepthTracker } from "@/components/NavDepthTracker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <NavDepthTracker />
      {children}
    </SessionProvider>
  );
}
