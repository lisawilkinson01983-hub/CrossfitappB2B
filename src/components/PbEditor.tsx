"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_DISPLAYED_PBS, PB_CATEGORIES, PB_FIELDS, type PbField } from "@/lib/validation";
import { PB_LABELS } from "@/lib/labels";

export type PbEditorInitial = {
  pbs: Record<PbField, number | "">;
  displayedPbs: PbField[];
};

/** A quick PB-only editor — used inline on the profile page's "Key PBs" card, so PBs can be added without a trip to the full profile-edit form. */
export function PbEditor({ initial, onSaved }: { initial: PbEditorInitial; onSaved: () => void }) {
  const router = useRouter();
  const [pbs, setPbs] = useState<Record<PbField, string>>(
    Object.fromEntries(PB_FIELDS.map((field) => [field, String(initial.pbs[field])])) as Record<PbField, string>
  );
  const [displayedPbs, setDisplayedPbs] = useState<PbField[]>(initial.displayedPbs);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const atMaxDisplayedPbs = displayedPbs.length >= MAX_DISPLAYED_PBS;

  function addDisplayedPb(field: PbField) {
    setDisplayedPbs((prev) => (prev.includes(field) || prev.length >= MAX_DISPLAYED_PBS ? prev : [...prev, field]));
  }

  function removeDisplayedPb(field: PbField) {
    setDisplayedPbs((prev) => prev.filter((f) => f !== field));
  }

  async function handleSave() {
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/profile/pbs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(PB_FIELDS.map((field) => [field, pbs[field]])),
        displayedPbs,
      }),
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
    <div className="flex flex-col gap-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-xs text-b2b-ink/50">
        Choose up to {MAX_DISPLAYED_PBS} to feature on your profile ({displayedPbs.length}/{MAX_DISPLAYED_PBS}{" "}
        featured).
      </p>

      {displayedPbs.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {displayedPbs.map((field) => (
            <div key={field} className="relative">
              <button
                type="button"
                onClick={() => removeDisplayedPb(field)}
                aria-label={`Remove ${PB_LABELS[field]}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600 hover:bg-gray-300"
              >
                ×
              </button>
              <label htmlFor={`pb-${field}`} className="block text-xs text-gray-600">
                {PB_LABELS[field]}
              </label>
              <input
                id={`pb-${field}`}
                type="number"
                step="0.5"
                min={0}
                value={pbs[field]}
                onChange={(e) => setPbs((prev) => ({ ...prev, [field]: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAllMovements((v) => !v)}
        className="text-sm font-medium text-b2b-pink hover:underline"
      >
        {showAllMovements ? "Hide other movements" : "+ Add more movements"}
      </button>

      {showAllMovements && (
        <div className="flex flex-col gap-4 rounded border border-gray-200 p-3">
          {atMaxDisplayedPbs && (
            <p className="text-xs text-amber-600">
              You've featured {MAX_DISPLAYED_PBS} — remove one above to feature another. You can still fill
              these in either way.
            </p>
          )}
          {PB_CATEGORIES.map((category) => {
            const available = category.fields.filter((field) => !displayedPbs.includes(field));
            if (available.length === 0) return null;
            return (
              <div key={category.label}>
                <p className="text-xs font-semibold text-gray-500">{category.label}</p>
                <div className="mt-1 flex flex-col gap-2">
                  {available.map((field) => (
                    <div key={field} className="flex items-center gap-2">
                      <label htmlFor={`pb-${field}`} className="flex-1 text-sm">
                        {PB_LABELS[field]}
                      </label>
                      <input
                        id={`pb-${field}`}
                        type="number"
                        step="0.5"
                        min={0}
                        value={pbs[field]}
                        onChange={(e) => setPbs((prev) => ({ ...prev, [field]: e.target.value }))}
                        className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => addDisplayedPb(field)}
                        disabled={atMaxDisplayedPbs}
                        className="whitespace-nowrap rounded-full border border-b2b-pink/30 px-2.5 py-1 text-xs font-medium text-b2b-pink hover:bg-b2b-pink/10 disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Feature
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save PBs"}
        </button>
        <button type="button" onClick={onSaved} className="text-sm text-b2b-ink/50 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
