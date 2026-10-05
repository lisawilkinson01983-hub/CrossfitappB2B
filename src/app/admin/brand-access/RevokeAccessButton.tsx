"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeAccessButton({ accountId, email }: { accountId: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revoke() {
    if (!window.confirm(`Remove ${email}'s access to the Box 2 Box profile?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/brand-access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={revoke}
      disabled={busy}
      className="shrink-0 text-xs text-red-600 underline disabled:opacity-50"
    >
      {busy ? "Removing..." : "Remove"}
    </button>
  );
}
