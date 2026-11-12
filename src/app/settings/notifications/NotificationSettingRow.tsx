"use client";

import { useState } from "react";

type Channel = "push" | "inApp";

export function NotificationSettingRow({
  settingKey,
  label,
  description,
  push,
  inApp,
}: {
  settingKey: string;
  label: string;
  description: string;
  push: boolean;
  /** null = no switch (always shown in the app, or not part of the bell list). */
  inApp: boolean | null;
}) {
  const [state, setState] = useState({ push, inApp });
  const [saving, setSaving] = useState<Channel | null>(null);
  const [error, setError] = useState(false);

  async function toggle(channel: Channel) {
    const next = !state[channel];
    setSaving(channel);
    setError(false);
    setState((s) => ({ ...s, [channel]: next })); // optimistic
    const res = await fetch("/api/settings/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, channel, enabled: next }),
    }).catch(() => null);
    setSaving(null);
    if (!res?.ok) {
      setState((s) => ({ ...s, [channel]: !next }));
      setError(true);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-b2b-ink">{label}</p>
        <p className="mt-0.5 text-xs text-b2b-ink/50">{description}</p>
        {error && <p className="mt-1 text-xs text-red-600">Couldn&apos;t save — try again.</p>}
      </div>
      <div className="flex shrink-0 gap-3">
        <Switch label="Push" on={state.push} disabled={saving === "push"} onClick={() => toggle("push")} name={label} />
        {state.inApp === null ? (
          <span className="w-11" aria-hidden />
        ) : (
          <Switch label="In app" on={state.inApp} disabled={saving === "inApp"} onClick={() => toggle("inApp")} name={label} />
        )}
      </div>
    </div>
  );
}

function Switch({ label, name, on, disabled, onClick }: { label: string; name: string; on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${name}: ${label}`}
      onClick={onClick}
      disabled={disabled}
      className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-b2b-pink" : "bg-gray-300"}`}
    >
      <span
        className={`absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}
