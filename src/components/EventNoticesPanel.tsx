"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  TEAMMATE_DIVISIONS,
  TEAMMATE_GENDERS,
  type TeammateDivisionOption,
  type TeammateGenderOption,
} from "@/lib/validation";
import { TEAMMATE_DIVISION_LABELS, TEAMMATE_GENDER_LABELS } from "@/lib/labels";
import { autoGrowTextarea } from "@/lib/autoGrowTextarea";
import { InfoDialog } from "./InfoDialog";

type TeammateRow = {
  id: number;
  // Kept as the raw string the user typed (not a number) so the field can be
  // emptied out and retyped — coercing it to a number on every keystroke
  // made it impossible to backspace the digit on mobile, since the value
  // would immediately snap back to "1" before the next keystroke landed.
  quantity: string;
  gender: TeammateGenderOption;
  division: TeammateDivisionOption;
};

function clampQuantityNumber(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(20, Math.round(n));
}

function clampQuantity(value: string): number {
  return clampQuantityNumber(Number(value));
}

/** Posts a "looking for teammates" request to the event's Notice Board. */
export function EventNoticesPanel({ eventId }: { eventId: string }) {
  const nextRowId = useRef(1);
  const router = useRouter();

  const [rows, setRows] = useState<TeammateRow[]>([{ id: 0, quantity: "1", gender: "ANY", division: "ANY" }]);
  const [detail, setDetail] = useState("");
  const [postToFeed, setPostToFeed] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);

  // Grows to fit what's typed instead of leaving it a fixed 2 rows with its
  // own internal scrollbar — same behavior as every other comment/message
  // box in the app (see autoGrowTextarea).
  const detailTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => autoGrowTextarea(detailTextareaRef.current), [detail]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
    e.target.value = "";
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId.current++, quantity: "1", gender: "ANY", division: "ANY" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function updateRow<K extends keyof TeammateRow>(id: number, field: K, value: TeammateRow[K]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function stepQuantity(id: number, delta: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, quantity: String(clampQuantityNumber(clampQuantity(r.quantity) + delta)) } : r
      )
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set(
      "teammateRequests",
      JSON.stringify(
        rows.map((row) => ({
          quantity: clampQuantity(row.quantity),
          gender: row.gender,
          division: row.division,
        }))
      )
    );
    formData.set("text", detail);
    if (postToFeed) formData.set("postToFeed", "on");
    if (photoFile) formData.set("photo", photoFile);

    const res = await fetch(`/api/events/${eventId}/notices`, { method: "POST", body: formData });
    setSubmitting(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "Something went wrong. Please try again.");
      return;
    }

    setRows([{ id: nextRowId.current++, quantity: "1", gender: "ANY", division: "ANY" }]);
    setDetail("");
    setPostToFeed(false);
    clearPhoto();
    setPosted(true);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div key={row.id} className="rounded border border-gray-200 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-b2b-ink/50">Athlete {index + 1}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove this line"
                    className="text-b2b-ink/40 hover:text-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="mt-1 grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`quantity-${row.id}`} className="block text-xs font-medium text-b2b-ink/60">
                    How many
                  </label>
                  <div className="mt-1 flex items-stretch rounded border border-gray-300 focus-within:border-b2b-pink">
                    <button
                      type="button"
                      onClick={() => stepQuantity(row.id, -1)}
                      aria-label="Decrease"
                      className="w-8 shrink-0 text-lg leading-none text-b2b-ink/50 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <input
                      id={`quantity-${row.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                      onBlur={() => updateRow(row.id, "quantity", String(clampQuantity(row.quantity)))}
                      className="w-full min-w-0 border-0 px-1 py-2 text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => stepQuantity(row.id, 1)}
                      aria-label="Increase"
                      className="w-8 shrink-0 text-lg leading-none text-b2b-ink/50 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor={`gender-${row.id}`} className="block text-xs font-medium text-b2b-ink/60">
                    Gender
                  </label>
                  <select
                    id={`gender-${row.id}`}
                    value={row.gender}
                    onChange={(e) => updateRow(row.id, "gender", e.target.value as TeammateGenderOption)}
                    className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-2 py-2 focus:border-b2b-pink focus:outline-none"
                  >
                    {TEAMMATE_GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {TEAMMATE_GENDER_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`division-${row.id}`} className="block text-xs font-medium text-b2b-ink/60">
                    Division
                  </label>
                  <select
                    id={`division-${row.id}`}
                    value={row.division}
                    onChange={(e) => updateRow(row.id, "division", e.target.value as TeammateDivisionOption)}
                    className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-2 py-2 focus:border-b2b-pink focus:outline-none"
                  >
                    {TEAMMATE_DIVISIONS.map((d) => (
                      <option key={d} value={d}>
                        {TEAMMATE_DIVISION_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="self-start text-sm font-medium text-b2b-pink hover:underline"
          >
            + Add another athlete
          </button>

          <div>
            <label htmlFor="detail" className="block text-xs font-medium text-b2b-ink/60">
              Extra detail (optional)
            </label>
            <textarea
              id="detail"
              ref={detailTextareaRef}
              rows={1}
              placeholder="Anything else worth mentioning..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="mt-1 w-full resize-none rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-b2b-ink/60">Attach a photo (optional)</span>
            <p className="mt-0.5 text-xs text-b2b-ink/50">
              E.g. a poster of the released competition workouts.
            </p>
            {photoPreview ? (
              <div className="relative mt-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- a transient local object URL, not a served photo */}
                <img src={photoPreview} alt="Attachment preview" className="h-24 rounded object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  aria-label="Remove photo"
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-b2b-ink/70 text-sm text-white hover:bg-b2b-ink"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="mt-2 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-b2b-bg"
              >
                📷 Add photo
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-b2b-ink/70">
            <input
              type="checkbox"
              checked={postToFeed}
              onChange={(e) => setPostToFeed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-b2b-pink focus:ring-b2b-pink"
            />
            Also post to main feed
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            {submitting ? "Posting..." : "Post notice"}
          </button>
        </div>
      </form>

      <InfoDialog
        open={posted}
        title="Posted!"
        message="Your search has been posted to the message board."
        onClose={() => setPosted(false)}
      />
    </div>
  );
}
