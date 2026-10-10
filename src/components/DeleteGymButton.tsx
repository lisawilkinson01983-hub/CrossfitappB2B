"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DeleteIcon } from "@/components/DeleteIcon";

/** Admin-only — permanently deletes an affiliate, then returns to Discover. */
export function DeleteGymButton({ gymId, gymName }: { gymId: string; gymName: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    const res = await fetch(`/api/gyms/${gymId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setConfirmOpen(false);
      return;
    }
    router.push("/discover?view=affiliates");
    router.refresh();
  }

  return (
    <div className="mt-4">
      {error && <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex items-center gap-2 rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <DeleteIcon className="h-4 w-4" />
        Delete this affiliate
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this affiliate?"
        message={`This permanently removes "${gymName}". Members affiliated with it will just show that name with no matching page, same as an unlisted affiliate. This can't be undone.`}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        confirming={deleting}
      />
    </div>
  );
}
