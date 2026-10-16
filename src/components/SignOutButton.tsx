"use client";

import { signOut } from "next-auth/react";
import { unregisterNativePush } from "@/components/NativePush";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await unregisterNativePush();
        signOut({ callbackUrl: "/login" });
      }}
      className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
    >
      Log out
    </button>
  );
}
