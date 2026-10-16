"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEVELS, MAX_LEVELS, type LevelOption } from "@/lib/validation";
import { LEVEL_LABELS } from "@/lib/labels";

export type AbilityEditorInitial = {
  levels: LevelOption[];
  openLevel: number | null;
  crossfitSinceYear: number | "";
  crossfitSinceMonth: number | "";
};

/** Level, Open badge and CrossFitting-since — the basics half of the "Ability" edit-profile page, saved separately from Competition stats below it (same split as PbEditor/CompetitionStatsQuickEditor). */
export function AbilityEditor({ initial }: { initial: AbilityEditorInitial }) {
  const router = useRouter();
  const [levels, setLevels] = useState<LevelOption[]>(initial.levels);
  const [openLevel, setOpenLevel] = useState(initial.openLevel ? String(initial.openLevel) : "");
  const [crossfitSinceYear, setCrossfitSinceYear] = useState(String(initial.crossfitSinceYear));
  const [crossfitSinceMonth, setCrossfitSinceMonth] = useState(String(initial.crossfitSinceMonth));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleLevel(option: LevelOption) {
    setLevels((prev) =>
      prev.includes(option) ? prev.filter((v) => v !== option) : prev.length >= MAX_LEVELS ? prev : [...prev, option]
    );
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (levels.length === 0) {
      setError("Select a level");
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/profile/ability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ levels, openLevel, crossfitSinceYear, crossfitSinceMonth }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <fieldset>
        <legend className="text-sm font-medium">Level</legend>
        <p className="mt-0.5 text-xs text-b2b-ink/50">
          Select up to {MAX_LEVELS} — competing across two abilities (e.g. Scaled and Intermediate) means teams
          searching for either can find you.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {LEVELS.map((l) => (
            <label key={l} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={levels.includes(l)}
                disabled={!levels.includes(l) && levels.length >= MAX_LEVELS}
                onChange={() => toggleLevel(l)}
              />
              {LEVEL_LABELS[l]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="openLevel" className="block text-sm font-medium">
          Official CrossFit Open level
        </label>
        <p className="mt-0.5 text-xs text-b2b-ink/50">
          Your most recent Open placement band, 1–10 (optional) — shown as a quick badge on your profile card.
          Re-enter this each year once the new Open results are in.
        </p>
        <select
          id="openLevel"
          value={openLevel}
          onChange={(e) => setOpenLevel(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
        >
          <option value="">Not set</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="block text-sm font-medium">CrossFitting since</span>
        <div className="mt-1 grid grid-cols-2 gap-4">
          <select
            aria-label="Month started CrossFit"
            value={crossfitSinceMonth}
            onChange={(e) => setCrossfitSinceMonth(e.target.value)}
            className="rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
          >
            <option value="">Month</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            aria-label="Year started CrossFit"
            type="number"
            placeholder="Year"
            min={1970}
            max={new Date().getFullYear()}
            value={crossfitSinceYear}
            onChange={(e) => setCrossfitSinceYear(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
      </div>
    </div>
  );
}
