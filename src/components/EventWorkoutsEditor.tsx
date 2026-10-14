"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type EventWorkoutEditData = {
  id: string;
  number: number;
  title: string;
  standards: string | null;
  workflow: string | null;
};

/**
 * The event edit page's "Workouts" manager — add/edit/delete the numbered
 * entries shown as "1" "2" "3"... buttons on the event page (see
 * EventWorkoutButtons). Available to whoever canEditEvent() lets onto this
 * page at all (admin, organizer, or claiming affiliate — see the page's own
 * gate), not just admins.
 */
export function EventWorkoutsEditor({ eventId, workouts }: { eventId: string; workouts: EventWorkoutEditData[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(
    url: string,
    method: "POST" | "PATCH",
    data: { title: string; standards: string; workflow: string }
  ) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-b2b-pink/30 bg-b2b-pink/10 font-display text-sm leading-none text-b2b-pink">
              {workout.number}
            </span>
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
          initial={{ title: "", standards: "", workflow: "" }}
          onClose={() => setAdding(false)}
          onSubmit={async (data) => {
            const ok = await submit(`/api/events/${eventId}/workouts`, "POST", data);
            if (ok) setAdding(false);
            return ok;
          }}
        />
      )}

      {editingWorkout && (
        <WorkoutFieldsModal
          title={`Edit workout ${editingWorkout.number}`}
          initial={{
            title: editingWorkout.title,
            standards: editingWorkout.standards ?? "",
            workflow: editingWorkout.workflow ?? "",
          }}
          onClose={() => setEditingId(null)}
          onSubmit={async (data) => {
            const ok = await submit(`/api/event-workouts/${editingWorkout.id}`, "PATCH", data);
            if (ok) setEditingId(null);
            return ok;
          }}
        />
      )}
    </div>
  );
}

/** A 3-field (title/standards/workflow) variant of the shared EditModal popout, used for both adding and editing a workout entry. */
function WorkoutFieldsModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: { title: string; standards: string; workflow: string };
  onClose: () => void;
  onSubmit: (data: { title: string; standards: string; workflow: string }) => Promise<boolean>;
}) {
  const [fields, setFields] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Title</span>
            <input
              value={fields.title}
              onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Standards</span>
            <textarea
              rows={3}
              value={fields.standards}
              onChange={(e) => setFields((f) => ({ ...f, standards: e.target.value }))}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Workflow</span>
            <textarea
              rows={4}
              value={fields.workflow}
              onChange={(e) => setFields((f) => ({ ...f, workflow: e.target.value }))}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </label>

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !fields.title.trim()}
              onClick={async () => {
                setSaving(true);
                setError(null);
                const ok = await onSubmit(fields);
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
