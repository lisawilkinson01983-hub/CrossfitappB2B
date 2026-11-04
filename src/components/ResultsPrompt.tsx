"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { formatEventDate } from "@/lib/eventDate";
import { divisionOptionsForEvent, resultHeadline } from "@/lib/eventResults";

type Prompt =
  | {
      kind: "solo";
      eventId: string;
      eventName: string;
      eventPhoto: string | null;
      eventDate: string;
      eventEndDate: string | null;
      isOnline: boolean;
      location: string | null;
      division: string | null;
    }
  | {
      kind: "team";
      eventId: string;
      eventName: string;
      eventPhoto: string | null;
      teamId: string;
      teamName: string;
      members: { id: string; name: string; photo: string | null }[];
      division: string | null;
    };

type UserOption = { id: string; name: string; photo: string | null };
type Step = "ask" | "placement" | "tag" | "confirm";

/**
 * The post-event "did you compete?" login prompt — fetches whether the
 * current user has an event waiting to be asked about (see
 * /api/event-results/prompt, gated by src/lib/resultsRollout.ts) and, if
 * so, walks them through logging a result. Mount once near the top of an
 * authenticated page (currently just /feed); renders nothing while loading
 * or when there's nothing to ask about.
 */
export function ResultsPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [step, setStep] = useState<Step>("ask");

  const [mode, setMode] = useState<"EXACT" | "COMPLETED">("EXACT");
  const [place, setPlace] = useState("");
  const [totalCompetitors, setTotalCompetitors] = useState("");
  const [division, setDivision] = useState("");
  const [note, setNote] = useState("");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserOption[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<UserOption[]>([]);
  const [freeformNames, setFreeformNames] = useState<string[]>([]);
  const [freeformInput, setFreeformInput] = useState<string | null>(null);

  const [resultId, setResultId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("COMPLETED");
  const [busy, setBusy] = useState(false);

  // Resets every per-event field so the next prompt (if any) starts clean at
  // "ask" rather than carrying over the previous event's placement/tags/etc.
  function resetFlowState() {
    setStep("ask");
    setMode("EXACT");
    setPlace("");
    setTotalCompetitors("");
    setDivision("");
    setNote("");
    setQuery("");
    setSearchResults([]);
    setTaggedUsers([]);
    setFreeformNames([]);
    setFreeformInput(null);
    setResultId(null);
    setHeadline("COMPLETED");
  }

  function loadNextPrompt() {
    return fetch("/api/event-results/prompt")
      .then((r) => r.json())
      .then((data) => {
        resetFlowState();
        if (data.prompt) {
          setPrompt(data.prompt);
          setDivision(divisionOptionsForEvent({ division: data.prompt.division })[0] ?? "");
        } else {
          setPrompt(null);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadNextPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "tag" || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => setSearchResults(data.users ?? []))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(handle);
  }, [query, step]);

  if (!prompt) return null;

  async function dismiss() {
    setBusy(true);
    await fetch("/api/event-results/prompt", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: prompt!.eventId }),
    }).catch(() => {});
    // Dismissing just this one event is what the API marks — there may still
    // be other past events waiting, so check again rather than closing for
    // the rest of the session (that's the whole point of asking about every
    // passed event, not just the single most recent one).
    await loadNextPrompt();
    setBusy(false);
  }

  async function submitResult(tags: { taggedUserIds: string[]; freeformNames: string[] }) {
    setBusy(true);
    try {
      const res = await fetch("/api/event-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: prompt!.eventId,
          teamId: prompt!.kind === "team" ? prompt!.teamId : undefined,
          placementType: mode,
          place: mode === "EXACT" && place ? Number(place) : undefined,
          totalCompetitors: mode === "EXACT" && totalCompetitors ? Number(totalCompetitors) : undefined,
          division: division || undefined,
          note: note || undefined,
          taggedUserIds: tags.taggedUserIds,
          freeformNames: tags.freeformNames,
        }),
      });
      const data = await res.json();
      setResultId(data.resultId ?? null);
      setHeadline(resultHeadline({ placementType: mode, place: mode === "EXACT" && place ? Number(place) : null }));
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!resultId) {
      await loadNextPrompt();
      setBusy(false);
      return;
    }
    setBusy(true);
    await fetch(`/api/event-results/${resultId}/share`, { method: "POST" }).catch(() => {});
    router.refresh();
    // More than one past event can be waiting — move straight to the next
    // one instead of closing until the next full page load.
    await loadNextPrompt();
    setBusy(false);
  }

  async function saveOnly() {
    setBusy(true);
    router.refresh();
    await loadNextPrompt();
    setBusy(false);
  }

  function toggleTag(user: UserOption) {
    setTaggedUsers((prev) => (prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]));
    setQuery("");
    setSearchResults([]);
  }

  function addFreeform() {
    const name = (freeformInput ?? "").trim();
    if (name) setFreeformNames((prev) => [...prev, name]);
    setFreeformInput(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-xs flex-col items-center gap-1 rounded-2xl bg-b2b-card p-6 text-center shadow-lg">
        {step === "ask" && prompt.kind === "solo" && (
          <>
            {prompt.eventPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={prompt.eventPhoto} alt="" className="mb-2 h-16 w-16 rounded-xl object-cover" />
            )}
            <p className="font-display text-lg uppercase leading-tight text-b2b-ink">
              Did you compete at {prompt.eventName}?
            </p>
            <p className="mt-1 text-xs text-b2b-ink/50">
              {formatEventDate({ date: new Date(prompt.eventDate), endDate: prompt.eventEndDate ? new Date(prompt.eventEndDate) : null })}
              {" · "}
              {prompt.isOnline ? "Online" : prompt.location}
            </p>
            <button
              type="button"
              onClick={() => setStep("placement")}
              className="mt-4 w-full rounded-full bg-b2b-ink px-4 py-2.5 text-sm font-semibold text-b2b-bg"
            >
              Yes, let&rsquo;s log it
            </button>
            <button type="button" onClick={dismiss} disabled={busy} className="mt-2 text-xs font-medium text-b2b-ink/40 hover:underline">
              No, I didn&rsquo;t make it
            </button>
          </>
        )}

        {step === "ask" && prompt.kind === "team" && (
          <>
            <p className="font-display text-lg uppercase leading-tight text-b2b-ink">
              Did Team {prompt.teamName} compete at {prompt.eventName}?
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex">
                {prompt.members.map((m, i) => (
                  <div key={m.id} className={i > 0 ? "-ml-2 rounded-full ring-2 ring-b2b-card" : "rounded-full"}>
                    <Avatar photo={m.photo} name={m.name} size={26} />
                  </div>
                ))}
              </div>
              <p className="min-w-0 flex-1 truncate text-left text-xs text-b2b-ink/50">
                {prompt.members.map((m) => m.name.split(" ")[0]).join(", ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("placement")}
              className="mt-4 w-full rounded-full bg-b2b-ink px-4 py-2.5 text-sm font-semibold text-b2b-bg"
            >
              Yes, let&rsquo;s log it
            </button>
            <button type="button" onClick={dismiss} disabled={busy} className="mt-2 text-xs font-medium text-b2b-ink/40 hover:underline">
              No, we didn&rsquo;t make it
            </button>
          </>
        )}

        {step === "placement" && (
          <>
            <p className="font-display text-lg uppercase leading-tight text-b2b-ink">
              How&rsquo;d it go at {prompt.eventName}?
            </p>

            <div className="mt-3 flex w-full rounded-lg bg-b2b-bg p-1">
              <button
                type="button"
                onClick={() => setMode("EXACT")}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${mode === "EXACT" ? "bg-b2b-card text-b2b-ink shadow-sm" : "text-b2b-ink/45"}`}
              >
                Exact placement
              </button>
              <button
                type="button"
                onClick={() => setMode("COMPLETED")}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${mode === "COMPLETED" ? "bg-b2b-card text-b2b-ink shadow-sm" : "text-b2b-ink/45"}`}
              >
                Just mark Completed
              </button>
            </div>

            {mode === "EXACT" && (
              <div className="mt-3 flex w-full items-center justify-center gap-2">
                <span className="text-sm font-medium text-b2b-ink">I placed</span>
                <input
                  type="number"
                  min={1}
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  className="w-14 rounded-lg bg-b2b-bg px-2 py-2 text-center font-display text-lg text-b2b-ink"
                />
                <span className="text-sm font-medium text-b2b-ink">of</span>
                <input
                  type="number"
                  min={1}
                  value={totalCompetitors}
                  onChange={(e) => setTotalCompetitors(e.target.value)}
                  className="w-14 rounded-lg bg-b2b-bg px-2 py-2 text-center font-display text-lg text-b2b-ink"
                />
              </div>
            )}

            <div className="mt-3 w-full text-left">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-b2b-ink/40">Division</p>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full rounded-lg border border-b2b-purple/15 bg-b2b-card px-3 py-2 text-sm text-b2b-ink"
              >
                {divisionOptionsForEvent({ division: prompt.division }).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 w-full text-left">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-b2b-ink/40">Add a note (optional)</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder="PR'd my clean & jerk on the last event..."
                className="w-full resize-none rounded-lg border border-b2b-purple/15 bg-b2b-card px-3 py-2 text-sm text-b2b-ink placeholder:text-b2b-ink/35"
              />
            </div>

            <button
              type="button"
              disabled={busy || (mode === "EXACT" && !place)}
              onClick={() => (prompt.kind === "team" ? submitResult({ taggedUserIds: [], freeformNames: [] }) : setStep("tag"))}
              className="mt-4 w-full rounded-full bg-b2b-ink px-4 py-2.5 text-sm font-semibold text-b2b-bg disabled:opacity-50"
            >
              Continue
            </button>
            <button type="button" onClick={dismiss} disabled={busy} className="mt-2 text-xs font-medium text-b2b-ink/40 hover:underline">
              Skip for now
            </button>
          </>
        )}

        {step === "tag" && (
          <>
            <p className="font-display text-lg uppercase leading-tight text-b2b-ink">Compete with anyone?</p>
            <p className="mt-1 text-xs text-b2b-ink/45">We&rsquo;ll offer to add this result to their profile too.</p>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your connections..."
              className="mt-3 w-full rounded-lg border border-b2b-purple/15 bg-b2b-card px-3 py-2 text-sm text-b2b-ink placeholder:text-b2b-ink/35"
            />
            {searchResults.length > 0 && (
              <div className="mt-1 flex w-full flex-col gap-1 rounded-lg border border-b2b-purple/10 bg-b2b-card p-1">
                {searchResults
                  .filter((u) => !taggedUsers.some((t) => t.id === u.id))
                  .map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleTag(u)}
                      className="flex items-center gap-2 rounded-md p-1.5 text-left hover:bg-b2b-bg"
                    >
                      <Avatar photo={u.photo} name={u.name} size={24} />
                      <span className="text-sm text-b2b-ink">{u.name}</span>
                    </button>
                  ))}
              </div>
            )}

            {(taggedUsers.length > 0 || freeformNames.length > 0) && (
              <div className="mt-2 flex w-full flex-wrap gap-1.5">
                {taggedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-1 rounded-full border border-b2b-pink bg-b2b-pink/10 py-1 pl-1 pr-2 text-xs font-semibold text-b2b-pink-dark"
                  >
                    <Avatar photo={u.photo} name={u.name} size={18} />
                    {u.name}
                    <button type="button" onClick={() => toggleTag(u)} aria-label={`Remove ${u.name}`}>
                      ✕
                    </button>
                  </span>
                ))}
                {freeformNames.map((name) => (
                  <span
                    key={name}
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-b2b-ink/30 bg-b2b-bg py-1 pl-2.5 pr-2 text-xs font-semibold text-b2b-ink/60"
                  >
                    {name}
                    <span className="text-[8px] font-bold uppercase text-b2b-ink/40">not on app</span>
                    <button
                      type="button"
                      onClick={() => setFreeformNames((prev) => prev.filter((n) => n !== name))}
                      aria-label={`Remove ${name}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {freeformInput === null ? (
              <button
                type="button"
                onClick={() => setFreeformInput("")}
                className="mt-2 flex items-center gap-1.5 self-start text-xs font-semibold text-b2b-pink"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-b2b-pink text-[10px]">+</span>
                Add someone not on Box 2 Box
              </button>
            ) : (
              <div className="mt-2 flex w-full items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={freeformInput}
                  onChange={(e) => setFreeformInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFreeform()}
                  placeholder="Their name"
                  className="flex-1 rounded-lg border border-b2b-purple/15 bg-b2b-card px-3 py-1.5 text-sm text-b2b-ink"
                />
                <button type="button" onClick={addFreeform} className="text-xs font-semibold text-b2b-pink">
                  Add
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                submitResult({ taggedUserIds: taggedUsers.map((u) => u.id), freeformNames })
              }
              className="mt-4 w-full rounded-full bg-b2b-ink px-4 py-2.5 text-sm font-semibold text-b2b-bg disabled:opacity-60"
            >
              {taggedUsers.length + freeformNames.length > 0
                ? `Tag ${taggedUsers.length + freeformNames.length} & continue`
                : "Continue"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => submitResult({ taggedUserIds: [], freeformNames: [] })}
              className="mt-2 text-xs font-medium text-b2b-ink/40 hover:underline"
            >
              I competed alone — skip
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-b2b-pink/10 text-2xl">
              {mode === "EXACT" && place && Number(place) <= 3 ? ["🥇", "🥈", "🥉"][Number(place) - 1] : "🏆"}
            </span>
            <p className="text-xs font-bold uppercase tracking-wide text-b2b-pink">Result logged</p>
            <p className="font-display text-3xl leading-none text-b2b-ink">{headline}</p>
            <p className="mt-1 text-xs text-b2b-ink/50">
              {prompt.eventName}
              {division && ` · ${division}`}
            </p>

            <button
              type="button"
              onClick={share}
              disabled={busy}
              className="mt-4 w-full rounded-full bg-b2b-pink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              🎉 Share to feed
            </button>
            <button type="button" onClick={saveOnly} disabled={busy} className="mt-2 text-xs font-medium text-b2b-ink/45 hover:underline">
              Just save it, don&rsquo;t post
            </button>
          </>
        )}
      </div>
    </div>
  );
}
