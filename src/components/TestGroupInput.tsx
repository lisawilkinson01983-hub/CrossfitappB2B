"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TestGroupInput({ userId, initialValue }: { userId: string; initialValue: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/users/${userId}/test-group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testGroup: value }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== (initialValue ?? "") && save()}
      disabled={saving}
      placeholder="unassigned"
      className="w-24 rounded border border-b2b-purple/15 bg-b2b-bg px-2 py-1 text-xs focus:border-b2b-pink focus:outline-none disabled:opacity-50"
    />
  );
}
