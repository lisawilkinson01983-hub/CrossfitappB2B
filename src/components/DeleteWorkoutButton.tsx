"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DeleteIcon } from "@/components/DeleteIcon";

export function DeleteWorkoutButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/workouts/${id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-label="Delete"
        className="text-red-600 hover:text-red-700"
      >
        <DeleteIcon className="h-3.5 w-3.5" />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        message="This will permanently remove this workout log entry."
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        confirming={deleting}
      />
    </>
  );
}
