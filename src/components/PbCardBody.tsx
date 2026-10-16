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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pbs.map((pb) => (
            <div key={pb.label} className="overflow-hidden rounded-xl border border-b2b-purple/10">
              <div className="bg-b2b-ink px-2.5 py-1.5">
                <p className="truncate text-[10px] font-bold uppercase tracking-wide text-b2b-bg">{pb.label}</p>
              </div>
              <div className="px-2.5 pb-2.5 pt-2">
                <p className="font-display text-2xl leading-none text-b2b-ink">
                  {pb.value}
                  <span className="ml-0.5 text-[13px] font-bold text-b2b-pink">kg</span>
                </p>
              </div>
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
