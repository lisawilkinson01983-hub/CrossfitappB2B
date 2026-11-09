"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PB_CATEGORIES, type PbField } from "@/lib/validation";
import { PB_LABELS } from "@/lib/labels";
import { NewPbCelebration, type NewPb } from "@/components/NewPbCelebration";
import { ShareSheet } from "@/components/share/ShareSheet";

/**
 * The "Log a Single Score" path from the workout logger's entry choice
 * (see LogEntryChoice) — one movement, one number, instead of the full WOD
 * form. A genuine improvement writes straight to the real PB field
 * (`User.<field>Kg`, see PB_FIELDS) via /api/workouts, so it reaches the
 * same New PB celebration + share flow the quick PB editor already has,
 * rather than just flagging the resulting post gold the way the full
 * workout form's plain "This was a PB" checkbox does on its own.
 */
export function SingleScoreForm({
  initialPbs,
  onBack,
}: {
  initialPbs: Record<PbField, number | "">;
  onBack: () => void;
}) {
  const router = useRouter();

  const [field, setField] = useState<PbField | "">("");
  const [score, setScore] = useState("");
  const [caption, setCaption] = useState("");
  // Only relevant once a movement with no recorded PB is chosen and a
  // score is entered — null means "not asked/answered yet".
  const [pbConfirmed, setPbConfirmed] = useState<boolean | null>(null);
  const [previousOverride, setPreviousOverride] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newPb, setNewPb] = useState<NewPb | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  const existingPb = field ? initialPbs[field] : "";
  const hasExistingPb = existingPb !== "";
  const scoreNum = score.trim() === "" ? null : Number(score);
  const scoreValid = scoreNum != null && Number.isFinite(scoreNum) && scoreNum > 0;
  const beatsExistingPb = hasExistingPb && scoreValid && scoreNum! > (existingPb as number);
  // The "is this a PB?" prompt only applies to a movement with nothing on
  // record at all — with a real existing value, the comparison above is
  // just a fact, not something to ask about.
  const needsPbConfirmation = field !== "" && !hasExistingPb && scoreValid;

  function handleFieldChange(value: string) {
    setField(value as PbField | "");
    setPbConfirmed(null);
    setPreviousOverride("");
  }

  function handleScoreChange(value: string) {
    setScore(value);
    setPbConfirmed(null);
    setPreviousOverride("");
  }

  const canSave = field !== "" && scoreValid && (!needsPbConfirmation || pbConfirmed !== null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave || !field || scoreNum == null) return;
    setError(null);
    setSubmitting(true);

    const isGenuinePb = hasExistingPb ? beatsExistingPb : pbConfirmed === true;

    const formData = new FormData();
    formData.set("wodName", PB_LABELS[field]);
    formData.set("score", `${scoreNum}kg`);
    formData.set("unit", "WEIGHT");
    // A single lift doesn't have a meaningful Rx/Scaled distinction the way
    // a WOD does — default it rather than make the user pick an option
    // that doesn't really apply here.
    formData.set("intensity", "RX");
    if (caption.trim()) formData.set("notes", caption.trim());
    formData.set("sharedToFeed", "on");
    if (isGenuinePb) formData.set("isPb", "on");
    formData.set("pbField", field);
    formData.set("pbValue", String(scoreNum));
    if (!hasExistingPb) {
      formData.set("pbConfirmed", pbConfirmed ? "true" : "false");
      if (pbConfirmed && previousOverride.trim()) formData.set("pbPreviousOverride", previousOverride.trim());
    }

    const res = await fetch("/api/workouts", { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const body = await res.json().catch(() => ({}));
    if (body.newPb) {
      // Stay open behind the celebration prompt instead of navigating away
      // immediately — dismissing it (or finishing a share) sends the user
      // on to /workouts, same end state as a normal save.
      setNewPb(body.newPb);
    } else {
      router.push("/workouts");
      router.refresh();
    }
  }

  function finish() {
    router.push("/workouts");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <button type="button" onClick={onBack} className="self-start text-sm text-b2b-ink/50 hover:text-b2b-ink">
          ← Back
        </button>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <label htmlFor="movement" className="block text-sm font-medium">
            Movement
          </label>
          <select
            id="movement"
            required
            value={field}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
          >
            <option value="" disabled>
              Choose a movement...
            </option>
            {PB_CATEGORIES.map((category) => (
              <optgroup key={category.label} label={category.label}>
                {category.fields.map((f) => (
                  <option key={f} value={f}>
                    {PB_LABELS[f]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="score" className="block text-sm font-medium">
            Score
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="score"
              type="number"
              step="0.5"
              min={0}
              required
              value={score}
              onChange={(e) => handleScoreChange(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
            <span className="text-sm font-semibold text-b2b-ink/50">kg</span>
          </div>
          {beatsExistingPb && (
            <p className="mt-1.5 text-xs font-semibold text-b2b-pink">
              ▲ Your current {PB_LABELS[field as PbField]} PB is {existingPb}kg — this would beat it.
            </p>
          )}
        </div>

        {needsPbConfirmation && (
          <div className="rounded-xl border border-b2b-pink/30 bg-b2b-pink/5 p-4">
            <p className="text-sm font-semibold text-b2b-pink">
              You don't have a {PB_LABELS[field as PbField]} PB on record yet
            </p>
            <p className="mt-1.5 text-sm text-b2b-ink/70">Is {scoreNum}kg a PB for you?</p>
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                onClick={() => setPbConfirmed(true)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                  pbConfirmed === true ? "bg-b2b-ink text-b2b-bg" : "border border-b2b-ink/20 text-b2b-ink/70 hover:border-b2b-ink/40"
                }`}
              >
                Yes, it's a PB
              </button>
              <button
                type="button"
                onClick={() => setPbConfirmed(false)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                  pbConfirmed === false ? "bg-b2b-ink text-b2b-bg" : "border border-b2b-ink/20 text-b2b-ink/70 hover:border-b2b-ink/40"
                }`}
              >
                No, just logging
              </button>
            </div>

            {pbConfirmed === true && (
              <div className="mt-4 border-t border-b2b-pink/20 pt-4">
                <label htmlFor="previousPb" className="block text-sm font-medium">
                  What was your old PB?
                </label>
                <p className="mt-1 text-xs text-b2b-ink/50">
                  So we can show your real improvement next to the new one. Leave it blank if you're not sure.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="previousPb"
                    type="number"
                    step="0.5"
                    min={0}
                    value={previousOverride}
                    onChange={(e) => setPreviousOverride(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
                  />
                  <span className="text-sm font-semibold text-b2b-ink/50">kg</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="caption" className="block text-sm font-medium">
            Caption (optional)
          </label>
          <textarea
            id="caption"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Say something about this lift..."
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!canSave || submitting}
          className="rounded bg-b2b-pink px-4 py-2 font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </form>

      {newPb && !shareSheetOpen && (
        <NewPbCelebration newPb={newPb} onShare={() => setShareSheetOpen(true)} onDismiss={finish} />
      )}

      {newPb && shareSheetOpen && (
        <ShareSheet
          target={{ kind: "pb", field: newPb.field, value: newPb.value, previous: newPb.previous }}
          onClose={() => {
            setShareSheetOpen(false);
            finish();
          }}
        />
      )}
    </>
  );
}
