"use client";

import { useState } from "react";
import { DeleteIcon } from "@/components/DeleteIcon";
import { COMPETITION_DIVISIONS, OTHER_DIVISION } from "@/lib/competitionDivisions";

export type OpenResultRow = {
  key: string;
  year: string;
  division: string;
  overallRank: string;
  countryRank: string;
};

export type CommunityCupResultRow = {
  key: string;
  year: string;
  division: string;
  rank: string;
  competition: string;
};

let rowKeySeq = 0;
function nextKey() {
  rowKeySeq += 1;
  return `row-${Date.now()}-${rowKeySeq}`;
}

const currentYear = new Date().getFullYear();

export function emptyOpenResultRow(): OpenResultRow {
  return { key: nextKey(), year: String(currentYear), division: "", overallRank: "", countryRank: "" };
}

export function emptyCommunityCupResultRow(): CommunityCupResultRow {
  return { key: nextKey(), year: String(currentYear), division: "", rank: "", competition: "" };
}

// Drops rows nobody actually filled in — Division is the one required field
// per row (the server rejects a blank one), so a row with ranks but no
// division is treated the same as an untouched row and silently dropped
// rather than erroring the whole save.
export function openResultRowsToPayload(rows: OpenResultRow[]) {
  return rows.filter((r) => r.division.trim()).map(({ key, ...rest }) => rest);
}
export function communityCupResultRowsToPayload(rows: CommunityCupResultRow[]) {
  return rows.filter((r) => r.division.trim()).map(({ key, ...rest }) => rest);
}

const LABEL_CLASS = "block text-[10px] font-semibold uppercase tracking-wide text-b2b-ink/45";
const FIELD_CLASS =
  "mt-1 w-full rounded-lg border border-b2b-purple/15 bg-b2b-bg px-2.5 py-1.5 text-sm text-b2b-ink focus:border-b2b-pink focus:outline-none";

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-b2b-ink/5 text-b2b-ink/50 hover:bg-b2b-ink/10 hover:text-red-600"
    >
      <DeleteIcon className="h-3.5 w-3.5" />
    </button>
  );
}

// A division typed before this dropdown existed (or something outside the
// preset list, e.g. an affiliate-only Community Cup category) still needs
// somewhere to live — same "Other, type your own" escape hatch as the gym
// picker (see OTHER_GYM).
function DivisionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPreset = COMPETITION_DIVISIONS.includes(value);
  // Local, not derived from `value` alone — picking "Other" clears the
  // stored division back to "" (so an abandoned Other row still drops out
  // of the payload like any other empty row), but the text box needs to
  // stay open while that happens rather than snapping back to the select.
  const [otherMode, setOtherMode] = useState(value !== "" && !isPreset);
  const selectValue = otherMode ? OTHER_DIVISION : isPreset ? value : "";

  return (
    <div>
      <select
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === OTHER_DIVISION) {
            setOtherMode(true);
            onChange("");
          } else {
            setOtherMode(false);
            onChange(e.target.value);
          }
        }}
        className={FIELD_CLASS}
      >
        <option value="">Select a division</option>
        {COMPETITION_DIVISIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
        <option value={OTHER_DIVISION}>Other</option>
      </select>
      {otherMode && (
        <input
          type="text"
          placeholder="Type your division"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_CLASS} mt-1.5`}
        />
      )}
    </div>
  );
}

function YearField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-b2b-ink/45">Year</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 rounded-lg border border-b2b-purple/15 bg-b2b-bg px-2 py-1 font-display text-lg text-b2b-ink focus:border-b2b-pink focus:outline-none"
      />
    </div>
  );
}

/**
 * The repeatable-rows editor behind the signup wizard's optional
 * "Competition stats" step and its Settings → Edit profile twin — purely
 * controlled (no fetching/saving of its own) so both call sites can manage
 * when the data actually gets persisted.
 */
export function CompetitionStatsEditor({
  openResults,
  onOpenResultsChange,
  communityCupResults,
  onCommunityCupResultsChange,
}: {
  openResults: OpenResultRow[];
  onOpenResultsChange: (rows: OpenResultRow[]) => void;
  communityCupResults: CommunityCupResultRow[];
  onCommunityCupResultsChange: (rows: CommunityCupResultRow[]) => void;
}) {
  function updateOpenRow(key: string, patch: Partial<OpenResultRow>) {
    onOpenResultsChange(openResults.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeOpenRow(key: string) {
    onOpenResultsChange(openResults.filter((r) => r.key !== key));
  }
  function updateCupRow(key: string, patch: Partial<CommunityCupResultRow>) {
    onCommunityCupResultsChange(communityCupResults.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeCupRow(key: string) {
    onCommunityCupResultsChange(communityCupResults.filter((r) => r.key !== key));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-display text-sm tracking-wide text-b2b-pink">CROSSFIT OPEN</p>
        <p className="mt-0.5 text-xs text-b2b-ink/50">
          Your overall rank and country rank, for your own gender/age division.
        </p>

        <div className="mt-2.5 flex flex-col gap-2">
          {openResults.map((row) => (
            <div key={row.key} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-3">
              <div className="flex items-center justify-between">
                <YearField value={row.year} onChange={(v) => updateOpenRow(row.key, { year: v })} />
                <RemoveButton onClick={() => removeOpenRow(row.key)} label="Remove this year" />
              </div>
              <div className="mt-2">
                <label className={LABEL_CLASS}>Division</label>
                <DivisionField value={row.division} onChange={(v) => updateOpenRow(row.key, { division: v })} />
              </div>
              <div className="mt-2 flex gap-2">
                <div className="flex-1">
                  <label className={LABEL_CLASS}>Overall rank</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 6867"
                    value={row.overallRank}
                    onChange={(e) => updateOpenRow(row.key, { overallRank: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="flex-1">
                  <label className={LABEL_CLASS}>Country rank</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 636"
                    value={row.countryRank}
                    onChange={(e) => updateOpenRow(row.key, { countryRank: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOpenResultsChange([...openResults, emptyOpenResultRow()])}
          className="mt-2 w-full rounded-lg border border-dashed border-b2b-pink/40 py-2 text-sm font-semibold text-b2b-pink hover:bg-b2b-pink/5"
        >
          + Add another year
        </button>
      </div>

      <div>
        <p className="font-display text-sm tracking-wide text-b2b-pink">COMMUNITY CUP</p>
        <p className="mt-0.5 text-xs text-b2b-ink/50">Your division, rank and competition level, per year.</p>

        <div className="mt-2.5 flex flex-col gap-2">
          {communityCupResults.map((row) => (
            <div key={row.key} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-3">
              <div className="flex items-center justify-between">
                <YearField value={row.year} onChange={(v) => updateCupRow(row.key, { year: v })} />
                <RemoveButton onClick={() => removeCupRow(row.key)} label="Remove this year" />
              </div>
              <div className="mt-2">
                <label className={LABEL_CLASS}>Division</label>
                <DivisionField value={row.division} onChange={(v) => updateCupRow(row.key, { division: v })} />
              </div>
              <div className="mt-2">
                <label className={LABEL_CLASS}>Rank</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 213"
                  value={row.rank}
                  onChange={(e) => updateCupRow(row.key, { rank: e.target.value })}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="mt-2">
                <label className={LABEL_CLASS}>Competition</label>
                <input
                  type="text"
                  placeholder="e.g. Level 6"
                  value={row.competition}
                  onChange={(e) => updateCupRow(row.key, { competition: e.target.value })}
                  className={FIELD_CLASS}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onCommunityCupResultsChange([...communityCupResults, emptyCommunityCupResultRow()])}
          className="mt-2 w-full rounded-lg border border-dashed border-b2b-pink/40 py-2 text-sm font-semibold text-b2b-pink hover:bg-b2b-pink/5"
        >
          + Add another year
        </button>
      </div>
    </div>
  );
}
