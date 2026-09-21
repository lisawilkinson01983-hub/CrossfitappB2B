"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded border border-b2b-purple/20 px-3 py-1.5 text-sm font-medium text-b2b-ink/70 hover:bg-b2b-purple/5"
    >
      Log out
    </button>
  );
}
