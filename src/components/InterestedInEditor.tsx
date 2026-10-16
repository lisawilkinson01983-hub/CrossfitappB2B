"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOOKING_FOR_OPTIONS, type LookingForOption } from "@/lib/validation";
import { LOOKING_FOR_LABELS } from "@/lib/labels";

export type InterestedInEditorInitial = {
  lookingFor: LookingForOption[];
  isSingle: boolean | null;
  showRelationshipStatus: boolean;
  showSingleBadge: boolean;
};

/** Renders isSingle's three states as a select: unanswered / yes / no. */
function isSingleToSelectValue(value: boolean | null): string {
  if (value === null) return "";
  return value ? "true" : "false";
}

/** Search tags + relationship status — the "Interested in" edit-profile page. */
export function InterestedInEditor({ initial, onSaved }: { initial: InterestedInEditorInitial; onSaved: () => void }) {
  const router = useRouter();
  const [lookingFor, setLookingFor] = useState<LookingForOption[]>(initial.lookingFor);
  const [isSingle, setIsSingle] = useState(isSingleToSelectValue(initial.isSingle));
  const [showRelationshipStatus, setShowRelationshipStatus] = useState(initial.showRelationshipStatus);
  const [showSingleBadge, setShowSingleBadge] = useState(initial.showSingleBadge);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleLookingFor(option: LookingForOption) {
    setLookingFor((prev) => (prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]));
  }

  async function handleSave() {
    setError(null);
    if (lookingFor.length === 0) {
      setError("Choose at least one thing you're looking for");
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/profile/interested-in", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lookingFor, isSingle, showRelationshipStatus, showSingleBadge }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.refresh();
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <fieldset>
        <legend className="text-sm font-medium">Looking for</legend>
        <p className="mt-0.5 text-xs text-b2b-ink/50">
          Choose at least one. Used for search &amp; discovery matching only — never shown on your profile.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {LOOKING_FOR_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lookingFor.includes(option)}
                onChange={() => toggleLookingFor(option)}
              />
              {LOOKING_FOR_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="isSingle" className="block text-sm font-medium">
          Relationship status
        </label>
        <select
          id="isSingle"
          value={isSingle}
          onChange={(e) => {
            setIsSingle(e.target.value);
            if (e.target.value === "") setShowRelationshipStatus(false);
            if (e.target.value !== "true") setShowSingleBadge(false);
          }}
          className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
        >
          <option value="">Prefer not to say</option>
          <option value="true">Single</option>
          <option value="false">In a relationship</option>
        </select>

        {isSingle !== "" && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showRelationshipStatus}
              onChange={(e) => setShowRelationshipStatus(e.target.checked)}
            />
            Display my relationship status on my profile
          </label>
        )}

        {isSingle === "true" && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showSingleBadge}
              onChange={(e) => setShowSingleBadge(e.target.checked)}
            />
            Show a single badge (💚) on my profile photo
          </label>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
