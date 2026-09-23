"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  TEAMMATE_DIVISIONS,
  TEAMMATE_GENDERS,
  type TeammateDivisionOption,
  type TeammateGenderOption,
} from "@/lib/validation";
import { TEAMMATE_DIVISION_LABELS, TEAMMATE_GENDER_LABELS } from "@/lib/labels";
import { EventNoticeCard, type EventNoticeData } from "./EventNoticeCard";
import { InfoDialog } from "./InfoDialog";

export type EventNoticeEntry = {
  notice: EventNoticeData;
  isOwn: boolean;
  isAuthorParticipating: boolean;
};

export type EventTeammateAlertEntry = {
  id: string;
  gender: TeammateGenderOption;
  division: TeammateDivisionOption;
};

type Mode = "teammate" | "findTeam";

type TeammateRow = {
  id: number;
  quantity: number;
  gender: TeammateGenderOption;
  division: TeammateDivisionOption;
};

function tabClass(active: boolean) {
  return `pb-2 ${active ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-b2b-ink/50"}`;
}

export function EventNoticesPanel({
  eventId,
  notices,
  myAlerts,
}: {
  eventId: string;
  notices: EventNoticeEntry[];
  myAlerts: EventTeammateAlertEntry[];
}) {
  const [mode, setMode] = useState<Mode>("teammate");
  const nextRowId = useRef(1);
  const router = useRouter();

  const [rows, setRows] = useState<TeammateRow[]>([{ id: 0, quantity: 1, gender: "ANY", division: "ANY" }]);
  const [detail, setDetail] = useState("");
  const [postToFeed, setPostToFeed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);

  const [filterGender, setFilterGender] = useState<TeammateGenderOption | "ALL">("ALL");
  const [filterDivision, setFilterDivision] = useState<TeammateDivisionOption | "ALL">("ALL");
  const filtering = filterGender !== "ALL" || filterDivision !== "ALL";

  const [alerts, setAlerts] = useState<EventTeammateAlertEntry[]>(myAlerts);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertInfo, setAlertInfo] = useState<string | null>(null);

  const alertGender: TeammateGenderOption = filterGender === "ALL" ? "ANY" : filterGender;
  const alertDivision: TeammateDivisionOption = filterDivision === "ALL" ? "ANY" : filterDivision;
  const matchingAlert = alerts.find((a) => a.gender === alertGender && a.division === alertDivision);

  async function handleToggleAlert() {
    setAlertBusy(true);
    if (matchingAlert) {
      const res = await fetch(`/api/teammate-alerts/${matchingAlert.id}`, { method: "DELETE" });
      setAlertBusy(false);
      if (res.ok) setAlerts((prev) => prev.filter((a) => a.id !== matchingAlert.id));
      return;
    }

    const res = await fetch(`/api/events/${eventId}/teammate-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gender: alertGender, division: alertDivision }),
    });
    setAlertBusy(false);
    if (!res.ok) return;
    const body = await res.json();
    setAlerts((prev) => [...prev, { id: body.alert.id, gender: alertGender, division: alertDivision }]);
    setAlertInfo(
      body.matchedCount > 0
        ? `You'll be notified when a team posts a request matching your search. We've also let ${body.matchedCount} team${body.matchedCount === 1 ? "" : "s"} already looking for someone like you know you're interested!`
        : "You'll be notified when a team posts a request matching your search."
    );
  }

  // Posted searches always land in the event chat (and the main feed, if
  // opted in) — they only show up here when actively searching for a team,
  // so the event page itself doesn't accumulate every request ever posted.
  const filteredNotices = useMemo(() => {
    if (!filtering) return [];
    return notices.filter(({ notice }) =>
      notice.teammateRequests.some((req) => {
        const genderMatches = filterGender === "ALL" || req.gender === "ANY" || req.gender === filterGender;
        const divisionMatches = filterDivision === "ALL" || req.division === "ANY" || req.division === filterDivision;
        return genderMatches && divisionMatches;
      })
    );
  }, [notices, filterGender, filterDivision, filtering]);

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

    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/events/${eventId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teammateRequests: rows.map((row) => ({ quantity: row.quantity, gender: row.gender, division: row.division })),
        text: detail,
        postToFeed,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "Something went wrong. Please try again.");
      return;
    }

    setRows([{ id: nextRowId.current++, quantity: 1, gender: "ANY", division: "ANY" }]);
    setDetail("");
    setPostToFeed(false);
    setPosted(true);
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-4 border-b border-b2b-purple/10 text-sm font-medium">
        <button type="button" onClick={() => setMode("teammate")} className={tabClass(mode === "teammate")}>
          🔍 Find a teammate
        </button>
        <button type="button" onClick={() => setMode("findTeam")} className={tabClass(mode === "findTeam")}>
          🔎 Find a team
        </button>
      </div>

      {mode === "findTeam" ? (
        <div className="mt-3 rounded border border-gray-200 p-3">
          <p className="text-xs font-medium text-b2b-ink/50">Find a team looking for someone like you</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="filter-gender" className="block text-xs font-medium text-b2b-ink/60">
                I am
              </label>
              <select
                id="filter-gender"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value as TeammateGenderOption | "ALL")}
                className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-2 py-2 focus:border-b2b-pink focus:outline-none"
              >
                <option value="ALL">Any gender</option>
                {TEAMMATE_GENDERS.filter((g) => g !== "ANY").map((g) => (
                  <option key={g} value={g}>
                    {TEAMMATE_GENDER_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-division" className="block text-xs font-medium text-b2b-ink/60">
                My division
              </label>
              <select
                id="filter-division"
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value as TeammateDivisionOption | "ALL")}
                className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-2 py-2 focus:border-b2b-pink focus:outline-none"
              >
                <option value="ALL">Any division</option>
                {TEAMMATE_DIVISIONS.filter((d) => d !== "ANY").map((d) => (
                  <option key={d} value={d}>
                    {TEAMMATE_DIVISION_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setFilterGender("ALL");
                setFilterDivision("ALL");
              }}
              className="mt-2 text-xs font-medium text-b2b-pink hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3">
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
      )}

      {filtering && (
        <div className="mt-4 border-t border-b2b-purple/10 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/40">
              {filteredNotices.length} matching {filteredNotices.length === 1 ? "notice" : "notices"}
            </p>
            <button
              type="button"
              onClick={handleToggleAlert}
              disabled={alertBusy}
              className="shrink-0 rounded-full border border-b2b-purple/20 bg-b2b-purple/10 px-3 py-1.5 text-xs font-semibold text-b2b-purple hover:bg-b2b-purple/20 disabled:opacity-50"
            >
              {alertBusy ? "..." : matchingAlert ? "🔔 Notified — tap to cancel" : "🔔 Notify me"}
            </button>
          </div>
          {filteredNotices.length === 0 ? (
            <p className="text-b2b-ink/40">No teams looking for that right now.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredNotices.map(({ notice, isOwn, isAuthorParticipating }) => (
                <EventNoticeCard key={notice.id} notice={notice} isOwn={isOwn} isAuthorParticipating={isAuthorParticipating} />
              ))}
            </div>
          )}
        </div>
      )}

      <InfoDialog
        open={posted}
        title="Posted!"
        message="Your search has been posted to the event chat."
        onClose={() => setPosted(false)}
      />

      <InfoDialog
        open={alertInfo !== null}
        title="Alert set!"
        message={alertInfo ?? ""}
        onClose={() => setAlertInfo(null)}
      />
    </div>
  );
}
