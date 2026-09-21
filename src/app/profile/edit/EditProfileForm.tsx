"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  GENDERS,
  LEVELS,
  LOOKING_FOR_OPTIONS,
  PB_FIELDS,
  type GenderOption,
  type LevelOption,
  type LookingForOption,
  type PbField,
} from "@/lib/validation";
import { GENDER_LABELS, LEVEL_LABELS, LOOKING_FOR_LABELS, PB_LABELS } from "@/lib/labels";
import { GYM_OPTIONS, OTHER_GYM } from "@/lib/gyms";

type Initial = {
  name: string;
  photo: string | null;
  bio: string;
  age: number | "";
  gender: GenderOption | "";
  area: string;
  affiliateGym: string;
  affiliateGymOther: string;
  level: LevelOption | "";
  crossfitSinceYear: number | "";
  crossfitSinceMonth: number | "";
  lookingFor: LookingForOption[];
  showLookingFor: boolean;
  isSingle: boolean | null;
  showRelationshipStatus: boolean;
  showAge: boolean;
  isPrivate: boolean;
  pbs: Record<PbField, number | "">;
};

/** Renders isSingle's three states as a select: unanswered / yes / no. */
function isSingleToSelectValue(value: boolean | null): string {
  if (value === null) return "";
  return value ? "true" : "false";
}

export function EditProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [age, setAge] = useState(String(initial.age));
  const [gender, setGender] = useState(initial.gender);
  const [area, setArea] = useState(initial.area);
  const [affiliateGym, setAffiliateGym] = useState(initial.affiliateGym);
  const [affiliateGymOther, setAffiliateGymOther] = useState(initial.affiliateGymOther);
  const isOtherGym = affiliateGym === OTHER_GYM;
  const [level, setLevel] = useState(initial.level);
  const [crossfitSinceYear, setCrossfitSinceYear] = useState(String(initial.crossfitSinceYear));
  const [crossfitSinceMonth, setCrossfitSinceMonth] = useState(String(initial.crossfitSinceMonth));
  const [lookingFor, setLookingFor] = useState<LookingForOption[]>(initial.lookingFor);
  const [showLookingFor, setShowLookingFor] = useState(initial.showLookingFor);
  const [isSingle, setIsSingle] = useState(isSingleToSelectValue(initial.isSingle));
  const [showRelationshipStatus, setShowRelationshipStatus] = useState(initial.showRelationshipStatus);
  const [showAge, setShowAge] = useState(initial.showAge);
  const [isPrivate, setIsPrivate] = useState(initial.isPrivate);
  const [pbs, setPbs] = useState<Record<PbField, string>>(
    Object.fromEntries(PB_FIELDS.map((field) => [field, String(initial.pbs[field])])) as Record<
      PbField,
      string
    >
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photo);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleLookingFor(option: LookingForOption) {
    setLookingFor((prev) =>
      prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]
    );
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("bio", bio);
    formData.set("age", age);
    formData.set("gender", gender);
    formData.set("area", area);
    formData.set("affiliateGym", affiliateGym);
    formData.set("affiliateGymOther", affiliateGymOther);
    formData.set("level", level);
    formData.set("crossfitSinceYear", crossfitSinceYear);
    formData.set("crossfitSinceMonth", crossfitSinceMonth);
    lookingFor.forEach((v) => formData.append("lookingFor", v));
    if (showLookingFor) formData.set("showLookingFor", "on");
    formData.set("isSingle", isSingle);
    if (showRelationshipStatus) formData.set("showRelationshipStatus", "on");
    if (showAge) formData.set("showAge", "on");
    if (isPrivate) formData.set("isPrivate", "on");
    PB_FIELDS.forEach((field) => formData.set(field, pbs[field]));
    if (photoFile) formData.set("photo", photoFile);

    const res = await fetch("/api/profile", { method: "PATCH", body: formData });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label className="block text-sm font-medium">Photo</label>
        <div className="mt-2 flex items-center gap-4">
          {photoPreview ? (
            <Image
              src={photoPreview}
              alt="Profile preview"
              width={80}
              height={80}
              unoptimized={photoPreview.startsWith("blob:")}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gray-200" />
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
        </div>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
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
        <label htmlFor="bio" className="block text-sm font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="age" className="block text-sm font-medium">
            Age
          </label>
          <input
            id="age"
            type="number"
            min={13}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
          />
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showAge} onChange={(e) => setShowAge(e.target.checked)} />
            Display my age on my profile
          </label>
        </div>

        <div>
          <label htmlFor="gender" className="block text-sm font-medium">
            Gender
          </label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as GenderOption)}
            className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
          >
            <option value="">Prefer not to say / unset</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="area" className="block text-sm font-medium">
          Area (town/city)
        </label>
        <input
          id="area"
          type="text"
          required
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="affiliateGym" className="block text-sm font-medium">
          Affiliate gym
        </label>
        <select
          id="affiliateGym"
          required
          value={affiliateGym}
          onChange={(e) => setAffiliateGym(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
        >
          <option value="" disabled>
            Select a gym
          </option>
          {GYM_OPTIONS.map((gym) => (
            <option key={gym} value={gym}>
              {gym}
            </option>
          ))}
          <option value={OTHER_GYM}>Other (not listed)</option>
        </select>
        {isOtherGym && (
          <input
            type="text"
            required
            placeholder="Enter your gym name"
            value={affiliateGymOther}
            onChange={(e) => setAffiliateGymOther(e.target.value)}
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
          />
        )}
      </div>

      <div>
        <label htmlFor="level" className="block text-sm font-medium">
          Level
        </label>
        <select
          id="level"
          required
          value={level}
          onChange={(e) => setLevel(e.target.value as LevelOption)}
          className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
        >
          <option value="" disabled>
            Select a level
          </option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="block text-sm font-medium">CrossFitting since</span>
        <div className="mt-1 grid grid-cols-2 gap-4">
          <select
            aria-label="Month started CrossFit"
            value={crossfitSinceMonth}
            onChange={(e) => setCrossfitSinceMonth(e.target.value)}
            className="rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
          >
            <option value="">Month</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            aria-label="Year started CrossFit"
            type="number"
            placeholder="Year"
            min={1970}
            max={new Date().getFullYear()}
            value={crossfitSinceYear}
            onChange={(e) => setCrossfitSinceYear(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Key PBs (kg)</legend>
        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {PB_FIELDS.map((field) => (
            <div key={field}>
              <label htmlFor={field} className="block text-xs text-gray-600">
                {PB_LABELS[field]}
              </label>
              <input
                id={field}
                type="number"
                step="0.5"
                min={0}
                value={pbs[field]}
                onChange={(e) => setPbs((prev) => ({ ...prev, [field]: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Looking for</legend>
        <div className="mt-2 flex flex-col gap-2">
          {LOOKING_FOR_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lookingFor.includes(option)}
                onChange={() => toggleLookingFor(option)}
              />
              {LOOKING_FOR_LABELS[option]}
            </label>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showLookingFor}
            onChange={(e) => setShowLookingFor(e.target.checked)}
          />
          Display my looking-for tags on my profile
        </label>
      </fieldset>

      <div>
        <label htmlFor="isSingle" className="block text-sm font-medium">
          Relationship status
        </label>
        <select
          id="isSingle"
          value={isSingle}
          onChange={(e) => {
            setIsSingle(e.target.value);
            if (e.target.value === "") setShowRelationshipStatus(false);
          }}
          className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
        >
          <option value="">Prefer not to say</option>
          <option value="true">Single</option>
          <option value="false">Not single</option>
        </select>

        {isSingle !== "" && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showRelationshipStatus}
              onChange={(e) => setShowRelationshipStatus(e.target.checked)}
            />
            Display my relationship status on my profile
          </label>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        Private profile (new followers will need to be approved)
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-b2b-pink px-4 py-2 font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
