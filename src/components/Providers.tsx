"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { NativePush } from "@/components/NativePush";
import { NavDepthTracker } from "@/components/NavDepthTracker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <NativePush />
      <NavDepthTracker />
      {children}
    </SessionProvider>
  );
}
