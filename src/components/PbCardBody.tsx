"use client";

import { useState } from "react";
import { PbEditor, type PbEditorInitial } from "@/components/PbEditor";

/** The "Key PBs" card's body — a read-only grid, plus (for the profile's owner) an inline editor toggled in place. */
export function PbCardBody({
  pbs,
  isOwner,
  editorInitial,
}: {
  pbs: { label: string; value: number }[];
  isOwner: boolean;
  editorInitial: PbEditorInitial;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <PbEditor initial={editorInitial} onSaved={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {pbs.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pbs.map((pb) => (
            <div key={pb.label} className="rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3 py-2">
              <p className="text-xs text-b2b-ink/50">{pb.label}</p>
              <p className="mt-0.5 text-lg font-semibold text-b2b-ink">{pb.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-b2b-ink/40">Not set</p>
      )}
      {isOwner && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start text-sm text-b2b-pink underline"
        >
          {pbs.length ? "Edit PBs" : "+ Add PBs"}
        </button>
      )}
    </div>
  );
}
