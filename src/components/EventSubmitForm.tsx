"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  EVENT_DIVISIONS,
  EVENT_GENDER_CATEGORIES,
  EVENT_TEAM_FORMATS,
  type EventDivisionOption,
  type EventGenderCategoryOption,
  type EventTeamFormatOption,
} from "@/lib/validation";
import {
  EVENT_DIVISION_LABELS,
  EVENT_GENDER_CATEGORY_LABELS,
  EVENT_TEAM_FORMAT_LABELS,
} from "@/lib/labels";

type DuplicateMatch = { id: string; name: string; date: string; location: string };

export function EventSubmitForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [postcode, setPostcode] = useState("");
  const [postcodeBusy, setPostcodeBusy] = useState(false);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [division, setDivision] = useState<EventDivisionOption[]>([]);
  const [teamFormat, setTeamFormat] = useState<EventTeamFormatOption[]>([]);
  const [genderCategory, setGenderCategory] = useState<EventGenderCategoryOption[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImage(file);
    if (file) setImagePreview(URL.createObjectURL(file));
  }

  async function handlePostcodeLookup() {
    if (!postcode.trim() || postcodeBusy) return;
    setPostcodeBusy(true);
    setPostcodeError(null);
    const res = await fetch(`/api/postcode-lookup?postcode=${encodeURIComponent(postcode)}`);
    setPostcodeBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPostcodeError(body.error ?? "Couldn't find that postcode");
      return;
    }
    const body = await res.json();
    setLocation(body.location);
  }

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!name.trim() || !date) {
      setDuplicates([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const params = new URLSearchParams({ name, date });
      const res = await fetch(`/api/events/check-duplicate?${params}`);
      if (res.ok) {
        const body = await res.json();
        setDuplicates(body.matches ?? []);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [name, date]);

  const duplicateKey = duplicates.map((m) => m.id).join(",");
  const showDuplicateWarning = duplicates.length > 0 && dismissedKey !== duplicateKey;

  function toggle<T extends string>(list: T[], setList: (v: T[]) => void, value: T) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!image) {
      setError("An event image is required");
      return;
    }
    if (division.length === 0 || teamFormat.length === 0 || genderCategory.length === 0) {
      setError("Select at least one option for division, team format, and gender category");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("date", date);
    formData.set("location", location);
    formData.set("websiteUrl", websiteUrl);
    formData.set("description", description);
    division.forEach((v) => formData.append("division", v));
    teamFormat.forEach((v) => formData.append("teamFormat", v));
    genderCategory.forEach((v) => formData.append("genderCategory", v));
    formData.set("image", image);

    const res = await fetch("/api/events/submit", { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    setName("");
    setDate("");
    setLocation("");
    setPostcode("");
    setPostcodeError(null);
    setWebsiteUrl("");
    setDescription("");
    setDivision([]);
    setTeamFormat([]);
    setGenderCategory([]);
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSubmitted(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {submitted && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          Submitted — it'll appear once a moderator reviews it. Check "Your submissions" below for its status.
        </p>
      )}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Event name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium">
          Date
        </label>
        <input
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full min-w-0 rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="postcode" className="block text-sm font-medium">
          Postcode
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="postcode"
            type="text"
            placeholder="e.g. BN27 3JF"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            className="w-full min-w-0 rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
          />
          <button
            type="button"
            onClick={handlePostcodeLookup}
            disabled={postcodeBusy || !postcode.trim()}
            className="whitespace-nowrap rounded border border-b2b-purple/20 px-3 py-2 text-sm font-medium text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink disabled:opacity-50"
          >
            {postcodeBusy ? "..." : "Find address"}
          </button>
        </div>
        {postcodeError && <p className="mt-1 text-xs text-red-600">{postcodeError}</p>}
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium">
          Location
        </label>
        <input
          id="location"
          type="text"
          required
          placeholder="Town, postcode, country"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 w-full min-w-0 rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
        <p className="mt-1 text-xs text-b2b-ink/40">
          Filled in from the postcode above — edit it if you'd like to add a venue name.
        </p>
      </div>

      {showDuplicateWarning && (
        <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          <p className="font-medium">This looks similar to an event already listed:</p>
          <ul className="mt-1 list-disc pl-5">
            {duplicates.map((m) => (
              <li key={m.id}>
                {m.name} — {new Date(m.date).toLocaleDateString()} · {m.location}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDismissedKey(duplicateKey)}
            className="mt-2 text-sm font-medium text-yellow-900 underline"
          >
            This is a different event — continue anyway
          </button>
        </div>
      )}

      <div>
        <label htmlFor="websiteUrl" className="block text-sm font-medium">
          Event website
        </label>
        <input
          id="websiteUrl"
          type="url"
          required
          placeholder="https://..."
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Event information
        </label>
        <textarea
          id="description"
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Division</legend>
        <div className="mt-2 flex flex-col gap-2">
          {EVENT_DIVISIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={division.includes(option)}
                onChange={() => toggle(division, setDivision, option)}
              />
              {EVENT_DIVISION_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Team format</legend>
        <div className="mt-2 flex flex-col gap-2">
          {EVENT_TEAM_FORMATS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={teamFormat.includes(option)}
                onChange={() => toggle(teamFormat, setTeamFormat, option)}
              />
              {EVENT_TEAM_FORMAT_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Gender category</legend>
        <div className="mt-2 flex flex-col gap-2">
          {EVENT_GENDER_CATEGORIES.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={genderCategory.includes(option)}
                onChange={() => toggle(genderCategory, setGenderCategory, option)}
              />
              {EVENT_GENDER_CATEGORY_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium">Event image</label>
        <div className="mt-2 flex items-center gap-4">
          {imagePreview ? (
            <Image
              src={imagePreview}
              alt="Event image preview"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-lg object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-lg bg-gray-200" />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-b2b-purple/20 px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink"
          >
            📷 {image ? "Change photo" : "Add photo"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-b2b-pink px-4 py-2 font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit event"}
      </button>
    </form>
  );
}
