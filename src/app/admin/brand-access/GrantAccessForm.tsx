"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function GrantAccessForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin/brand-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <input
          type="email"
          required
          placeholder="admin@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || !email}
          className="shrink-0 rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Grant access"}
        </button>
      </div>
    </form>
  );
}
