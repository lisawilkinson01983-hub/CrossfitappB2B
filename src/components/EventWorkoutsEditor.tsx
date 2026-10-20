"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export type EventWorkoutEditData = {
  id: string;
  number: number;
  title: string;
  workout: string | null;
  standards: string | null;
  workflow: string | null;
  scaledWorkout: string | null;
  scaledStandards: string | null;
  scaledWorkflow: string | null;
  photo: string | null;
};

/**
 * The event edit page's "Workouts" manager — add/edit/delete the numbered
 * entries shown on the event's dedicated Workouts page (see
 * EventWorkoutsList). Available to whoever canEditEvent() lets onto this
 * page at all (admin, organizer, or claiming affiliate — see the page's own
 * gate), not just admins.
 */
export function EventWorkoutsEditor({ eventId, workouts }: { eventId: string; workouts: EventWorkoutEditData[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(url: string, method: "POST" | "PATCH", formData: FormData) {
    const res = await fetch(url, { method, body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return false;
    }
    setError(null);
    router.refresh();
    return true;
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/event-workouts/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) router.refresh();
  }

  const editingWorkout = workouts.find((w) => w.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      {workouts.length === 0 && <p className="text-b2b-ink/40">None yet.</p>}

      {workouts.map((workout) => (
        <div
          key={workout.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3.5 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-3">
            {workout.photo ? (
              <Image
                src={workout.photo}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-b2b-pink/30 bg-b2b-pink/10 font-display text-sm leading-none text-b2b-pink">
                {workout.number}
              </span>
            )}
            <span className="truncate text-sm font-medium text-b2b-ink">{workout.title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingId(workout.id)}
              className="text-xs font-medium text-b2b-pink hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleDelete(workout.id)}
              disabled={deletingId === workout.id}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              {deletingId === workout.id ? "Removing..." : "Remove"}
            </button>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-1 rounded-lg border border-dashed border-b2b-purple/25 py-2 text-sm font-medium text-b2b-ink/60 hover:border-b2b-pink/40 hover:text-b2b-pink"
      >
        + Add a workout
      </button>

      {adding && (
        <WorkoutFieldsModal
          title="Add workout"
          initial={{
            number: String(Math.max(0, ...workouts.map((w) => w.number)) + 1),
            title: "",
            workout: "",
            standards: "",
            workflow: "",
            scaledWorkout: "",
            scaledStandards: "",
            scaledWorkflow: "",
            photo: null,
          }}
          onClose={() => setAdding(false)}
          onSubmit={async (formData) => {
            const ok = await submit(`/api/events/${eventId}/workouts`, "POST", formData);
            if (ok) setAdding(false);
            return ok;
          }}
        />
      )}

      {editingWorkout && (
        <WorkoutFieldsModal
          title={`Edit workout ${editingWorkout.number}`}
          initial={{
            number: String(editingWorkout.number),
            title: editingWorkout.title,
            workout: editingWorkout.workout ?? "",
            standards: editingWorkout.standards ?? "",
            workflow: editingWorkout.workflow ?? "",
            scaledWorkout: editingWorkout.scaledWorkout ?? "",
            scaledStandards: editingWorkout.scaledStandards ?? "",
            scaledWorkflow: editingWorkout.scaledWorkflow ?? "",
            photo: editingWorkout.photo,
          }}
          onClose={() => setEditingId(null)}
          onSubmit={async (formData) => {
            const ok = await submit(`/api/event-workouts/${editingWorkout.id}`, "PATCH", formData);
            if (ok) setEditingId(null);
            return ok;
          }}
        />
      )}
    </div>
  );
}

type WorkoutFields = {
  number: string;
  title: string;
  workout: string;
  standards: string;
  workflow: string;
  scaledWorkout: string;
  scaledStandards: string;
  scaledWorkflow: string;
  photo: string | null;
};

/** A 5-field (number/title/workout/standards/workflow) + poster variant of the shared EditModal popout, used for both adding and editing a workout entry. */
function WorkoutFieldsModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: WorkoutFields;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<boolean>;
}) {
  const [fields, setFields] = useState(initial);
  const [division, setDivision] = useState<"rx" | "scaled">("rx");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photo);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  function handleRemovePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-b2b-bg p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-b2b-purple/10 pb-3">
          <p className="font-semibold text-b2b-ink">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-b2b-ink/40 hover:text-b2b-ink/70">
            ×
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">
              Poster <span className="font-normal normal-case text-b2b-ink/40">(optional)</span>
            </span>
            <p className="text-xs text-b2b-ink/40">
              Shown as the header on this workout's page, and as the card image when browsing workouts as a carousel.
            </p>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <Image src={photoPreview} alt="" width={64} height={64} className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-b2b-purple/25 text-[10px] text-b2b-ink/35">
                  No poster
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="cursor-pointer rounded-full border border-b2b-purple/20 px-3 py-1.5 text-xs font-medium text-b2b-ink/70 hover:border-b2b-pink/40 hover:text-b2b-pink">
                  {photoPreview ? "Change poster" : "Add poster"}
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                </label>
                {photoPreview && (
                  <button type="button" onClick={handleRemovePhoto} className="text-xs font-medium text-red-600 hover:underline">
                    Remove poster
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <label className="flex w-20 shrink-0 flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Number</span>
              <input
                type="number"
                min={1}
                max={99}
                value={fields.number}
                onChange={(e) => setFields((f) => ({ ...f, number: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Title</span>
              <input
                value={fields.title}
                onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
              />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Division</span>
            <div className="flex rounded-full bg-b2b-purple/10 p-1">
              <button
                type="button"
                onClick={() => setDivision("rx")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  division === "rx" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
                }`}
              >
                RX
              </button>
              <button
                type="button"
                onClick={() => setDivision("scaled")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  division === "scaled" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
                }`}
              >
                Scaled
              </button>
            </div>
          </div>
          {division === "scaled" && (
            <p className="-mt-2 text-xs text-b2b-ink/40">
              Leave these blank to show only an RX version — the workout's page won't show a separate Scaled tab at
              all unless at least one of these is filled in.
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Workout</span>
            <textarea
              rows={4}
              value={division === "rx" ? fields.workout : fields.scaledWorkout}
              onChange={(e) =>
                setFields((f) =>
                  division === "rx" ? { ...f, workout: e.target.value } : { ...f, scaledWorkout: e.target.value }
                )
              }
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Standards</span>
            <textarea
              rows={3}
              value={division === "rx" ? fields.standards : fields.scaledStandards}
              onChange={(e) =>
                setFields((f) =>
                  division === "rx" ? { ...f, standards: e.target.value } : { ...f, scaledStandards: e.target.value }
                )
              }
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Workflow</span>
            <textarea
              rows={4}
              value={division === "rx" ? fields.workflow : fields.scaledWorkflow}
              onChange={(e) =>
                setFields((f) =>
                  division === "rx" ? { ...f, workflow: e.target.value } : { ...f, scaledWorkflow: e.target.value }
                )
              }
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </label>

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !fields.title.trim() || !fields.number.trim() || Number(fields.number) < 1}
              onClick={async () => {
                setSaving(true);
                setError(null);
                const formData = new FormData();
                formData.set("number", fields.number);
                formData.set("title", fields.title);
                formData.set("workout", fields.workout);
                formData.set("standards", fields.standards);
                formData.set("workflow", fields.workflow);
                formData.set("scaledWorkout", fields.scaledWorkout);
                formData.set("scaledStandards", fields.scaledStandards);
                formData.set("scaledWorkflow", fields.scaledWorkflow);
                if (photoFile) formData.set("photo", photoFile);
                if (removePhoto) formData.set("removePhoto", "on");
                const ok = await onSubmit(formData);
                setSaving(false);
                if (!ok) setError("Something went wrong. Please try again.");
              }}
              className="rounded-full bg-b2b-pink px-5 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
