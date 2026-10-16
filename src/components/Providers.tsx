"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { NativePush } from "@/components/NativePush";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <NativePush />
      {children}
    </SessionProvider>
  );
}
