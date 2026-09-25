"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GENDERS, LEVELS, type GenderOption, type LevelOption } from "@/lib/validation";
import { GENDER_LABELS, LEVEL_LABELS } from "@/lib/labels";
import { COUNTRIES, type Country } from "@/lib/countries";
import { DISTANCE_RANGES } from "@/lib/geocode";
import { OTHER_GYM } from "@/lib/gyms";

type Audience = {
  gender: GenderOption | "";
  minAge: string;
  maxAge: string;
  level: LevelOption | "";
  affiliateGym: string;
  country: Country | "";
  areaQuery: string;
  radiusMiles: (typeof DISTANCE_RANGES)[number] | "";
};

const EMPTY_AUDIENCE: Audience = {
  gender: "",
  minAge: "",
  maxAge: "",
  level: "",
  affiliateGym: "",
  country: "",
  areaQuery: "",
  radiusMiles: "",
};

function toAudiencePayload(a: Audience) {
  return {
    gender: a.gender || undefined,
    minAge: a.minAge || undefined,
    maxAge: a.maxAge || undefined,
    level: a.level || undefined,
    affiliateGym: a.affiliateGym && a.affiliateGym !== OTHER_GYM ? a.affiliateGym : undefined,
    country: a.country || undefined,
    areaQuery: a.areaQuery || undefined,
    radiusMiles: a.areaQuery ? a.radiusMiles || undefined : undefined,
  };
}

export function ComposeNoticeForm({ gymOptions }: { gymOptions: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>(EMPTY_AUDIENCE);

  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCountLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/notices/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toAudiencePayload(audience)),
        });
        const data = await res.json();
        setCount(res.ok ? data.count : null);
      } catch {
        setCount(null);
      } finally {
        setCountLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [audience]);

  function setField<K extends keyof Audience>(key: K, value: Audience[K]) {
    setAudience((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (count === null || count === 0) {
      setError("No one matches this audience yet");
      return;
    }
    if (!window.confirm(`Send this notice to ${count} ${count === 1 ? "person" : "people"}? This can't be undone.`)) {
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, audience: toAudiencePayload(audience) }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSuccess(`Sent to ${data.recipientCount} ${data.recipientCount === 1 ? "person" : "people"}.`);
    setTitle("");
    setBody("");
    setAudience(EMPTY_AUDIENCE);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      <div>
        <label htmlFor="notice-title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="notice-title"
          type="text"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="notice-body" className="block text-sm font-medium">
          Message
        </label>
        <textarea
          id="notice-body"
          rows={4}
          required
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <fieldset className="rounded-lg border border-b2b-purple/10 p-4">
        <legend className="px-1 text-sm font-medium">Audience — leave anything unset to include everyone</legend>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="notice-gender" className="block text-xs font-medium text-b2b-ink/60">
              Gender
            </label>
            <select
              id="notice-gender"
              value={audience.gender}
              onChange={(e) => setField("gender", e.target.value as GenderOption | "")}
              className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            >
              <option value="">Any</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="notice-level" className="block text-xs font-medium text-b2b-ink/60">
              Ability
            </label>
            <select
              id="notice-level"
              value={audience.level}
              onChange={(e) => setField("level", e.target.value as LevelOption | "")}
              className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            >
              <option value="">Any</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="notice-min-age" className="block text-xs font-medium text-b2b-ink/60">
              Min age
            </label>
            <input
              id="notice-min-age"
              type="number"
              min={13}
              max={120}
              value={audience.minAge}
              onChange={(e) => setField("minAge", e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="notice-max-age" className="block text-xs font-medium text-b2b-ink/60">
              Max age
            </label>
            <input
              id="notice-max-age"
              type="number"
              min={13}
              max={120}
              value={audience.maxAge}
              onChange={(e) => setField("maxAge", e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="notice-gym" className="block text-xs font-medium text-b2b-ink/60">
              Affiliate gym
            </label>
            <select
              id="notice-gym"
              value={audience.affiliateGym}
              onChange={(e) => setField("affiliateGym", e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            >
              <option value="">Any</option>
              {gymOptions.map((gym) => (
                <option key={gym} value={gym}>
                  {gym}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="notice-country" className="block text-xs font-medium text-b2b-ink/60">
              Country
            </label>
            <select
              id="notice-country"
              value={audience.country}
              onChange={(e) => setField("country", e.target.value as Country | "")}
              className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            >
              <option value="">Any</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="notice-area" className="block text-xs font-medium text-b2b-ink/60">
              Near this town/city
            </label>
            <input
              id="notice-area"
              type="text"
              placeholder="e.g. Uckfield"
              value={audience.areaQuery}
              onChange={(e) => setField("areaQuery", e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="notice-radius" className="block text-xs font-medium text-b2b-ink/60">
              Within
            </label>
            <select
              id="notice-radius"
              disabled={!audience.areaQuery}
              value={audience.radiusMiles}
              onChange={(e) =>
                setField("radiusMiles", (e.target.value ? Number(e.target.value) : "") as Audience["radiusMiles"])
              }
              className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none disabled:opacity-50"
            >
              {DISTANCE_RANGES.map((d) => (
                <option key={d} value={d}>
                  {d} miles
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center justify-between rounded-lg bg-b2b-purple/5 px-4 py-3">
        <p className="text-sm">
          {countLoading ? (
            <span className="text-b2b-ink/50">Counting…</span>
          ) : count === null ? (
            <span className="text-b2b-ink/50">Couldn&apos;t count matches</span>
          ) : (
            <>
              <span className="font-semibold">{count}</span> {count === 1 ? "person" : "people"} match
            </>
          )}
        </p>
        <button
          type="submit"
          disabled={submitting || !title || !body || !count}
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send notice"}
        </button>
      </div>
    </form>
  );
}
