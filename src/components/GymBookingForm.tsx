"use client";

import { useState } from "react";

export function GymBookingForm({ gymId, initialEmail }: { gymId: string; initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/gyms/${gymId}/book`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingEmail: email }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage({ kind: "success", text: "Saved." });
      return;
    }
    const body = await res.json().catch(() => null);
    setMessage({ kind: "error", text: body?.error ?? "Couldn't save that. Please try again." });
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3">
      <div>
        <label htmlFor="bookingEmail" className="block text-sm font-medium">
          Booking email
        </label>
        <input
          id="bookingEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="bookings@yourgym.com"
          className="mt-1 w-full rounded border border-b2b-purple/20 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-b2b-ink/50">
          {email.trim()
            ? "Booking taps will open the athlete's email client addressed to this."
            : "Left blank — booking taps will arrive as an in-app message to you instead."}
        </p>
      </div>

      {message && (
        <p className={`text-sm ${message.kind === "success" ? "text-green-600" : "text-red-600"}`}>{message.text}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
