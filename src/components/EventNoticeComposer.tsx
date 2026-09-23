"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  TEAMMATE_DIVISIONS,
  TEAMMATE_GENDERS,
  type TeammateDivisionOption,
  type TeammateGenderOption,
} from "@/lib/validation";
import { TEAMMATE_DIVISION_LABELS, TEAMMATE_GENDER_LABELS } from "@/lib/labels";

type Mode = "teammate" | "other";

type TeammateRow = {
  id: number;
  quantity: number;
  gender: TeammateGenderOption;
  division: TeammateDivisionOption;
};

export function EventNoticeComposer({ eventId }: { eventId: string }) {
  const [mode, setMode] = useState<Mode>("teammate");
  const nextRowId = useRef(1);

  const [rows, setRows] = useState<TeammateRow[]>([{ id: 0, quantity: 1, gender: "ANY", division: "ANY" }]);
  const [detail, setDetail] = useState("");

  const [text, setText] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId.current++, quantity: 1, gender: "ANY", division: "ANY" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function updateRow<K extends keyof TeammateRow>(id: number, field: K, value: TeammateRow[K]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (mode === "other" && !text.trim()) {
      setError("Write something first");
      return;
    }

    setError(null);
    setSubmitting(true);

    if (mode === "other") {
      const res = await fetch(`/api/events/${eventId}/notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setSubmitting(false);
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        setError(resBody.error ?? "Something went wrong. Please try again.");
        return;
      }
      setText("");
      router.refresh();
      return;
    }

    // mode === "teammate": post one notice per row so each athlete request
    // gets its own formatted card in the feed.
    for (const row of rows) {
      const res = await fetch(`/api/events/${eventId}/notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teammateQuantity: row.quantity,
          teammateGender: row.gender,
          teammateDivision: row.division,
          text: detail,
        }),
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        setSubmitting(false);
        setError(resBody.error ?? "Something went wrong. Please try again.");
        router.refresh();
        return;
      }
    }

    setSubmitting(false);
    setRows([{ id: nextRowId.current++, quantity: 1, gender: "ANY", division: "ANY" }]);
    setDetail("");
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-4 border-b border-b2b-purple/10 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("teammate")}
          className={`pb-2 ${mode === "teammate" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-b2b-ink/50"}`}
        >
          🔍 Find a teammate
        </button>
        <button
          type="button"
          onClick={() => setMode("other")}
          className={`pb-2 ${mode === "other" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-b2b-ink/50"}`}
        >
          💬 Other notice
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-3">
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {mode === "teammate" ? (
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
                    <input
                      id={`quantity-${row.id}`}
                      type="number"
                      min={1}
                      max={20}
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, "quantity", Number(e.target.value) || 1)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-2 focus:border-b2b-pink focus:outline-none"
                    />
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
                rows={2}
                placeholder="Anything else worth mentioning..."
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <textarea
            rows={3}
            placeholder="Looking for a lift, a training partner, or something else? Post it here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
          />
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            {submitting
              ? "Posting..."
              : mode === "teammate" && rows.length > 1
                ? `Post ${rows.length} notices`
                : "Post notice"}
          </button>
        </div>
      </form>
    </div>
  );
}
