"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ACCOUNT_TYPES,
  GENDERS,
  LEVELS,
  LOOKING_FOR_OPTIONS,
  MAX_DISPLAYED_PBS,
  PB_CATEGORIES,
  PB_FIELDS,
  type AccountTypeOption,
  type GenderOption,
  type LevelOption,
  type LookingForOption,
  type PbField,
} from "@/lib/validation";
import { GENDER_LABELS, LEVEL_LABELS, LOOKING_FOR_LABELS, PB_LABELS } from "@/lib/labels";
import { OTHER_GYM } from "@/lib/gyms";

type Initial = {
  name: string;
  photo: string | null;
  accountType: AccountTypeOption;
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
  showSingleBadge: boolean;
  showAge: boolean;
  isPrivate: boolean;
  pbs: Record<PbField, number | "">;
  displayedPbs: PbField[];
  verificationRequested: boolean;
  isVerified: boolean;
};

/** Renders isSingle's three states as a select: unanswered / yes / no. */
function isSingleToSelectValue(value: boolean | null): string {
  if (value === null) return "";
  return value ? "true" : "false";
}

export function EditProfileForm({ initial, gymOptions }: { initial: Initial; gymOptions: string[] }) {
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [accountType, setAccountType] = useState<AccountTypeOption>(initial.accountType);
  const isAthlete = accountType === "ATHLETE";
  const [verificationRequested, setVerificationRequested] = useState(initial.verificationRequested);
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
  const [showSingleBadge, setShowSingleBadge] = useState(initial.showSingleBadge);
  const [showAge, setShowAge] = useState(initial.showAge);
  const [isPrivate, setIsPrivate] = useState(initial.isPrivate);
  const [pbs, setPbs] = useState<Record<PbField, string>>(
    Object.fromEntries(PB_FIELDS.map((field) => [field, String(initial.pbs[field])])) as Record<
      PbField,
      string
    >
  );
  const [displayedPbs, setDisplayedPbs] = useState<PbField[]>(initial.displayedPbs);
  const [showAddMorePbs, setShowAddMorePbs] = useState(() =>
    PB_FIELDS.some((field) => !initial.displayedPbs.includes(field) && initial.pbs[field] !== "")
  );
  const atMaxDisplayedPbs = displayedPbs.length >= MAX_DISPLAYED_PBS;

  function addDisplayedPb(field: PbField) {
    setDisplayedPbs((prev) => (prev.includes(field) || prev.length >= MAX_DISPLAYED_PBS ? prev : [...prev, field]));
  }

  function removeDisplayedPb(field: PbField) {
    setDisplayedPbs((prev) => prev.filter((f) => f !== field));
  }
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photo);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
    formData.set("accountType", accountType);
    formData.set("bio", bio);
    formData.set("area", area);
    formData.set("affiliateGym", affiliateGym);
    formData.set("affiliateGymOther", affiliateGymOther);
    formData.set("crossfitSinceYear", crossfitSinceYear);
    formData.set("crossfitSinceMonth", crossfitSinceMonth);
    if (isAthlete) {
      formData.set("age", age);
      formData.set("gender", gender);
      formData.set("level", level);
      lookingFor.forEach((v) => formData.append("lookingFor", v));
      if (showLookingFor) formData.set("showLookingFor", "on");
      formData.set("isSingle", isSingle);
      if (showRelationshipStatus) formData.set("showRelationshipStatus", "on");
      if (showSingleBadge) formData.set("showSingleBadge", "on");
      if (showAge) formData.set("showAge", "on");
      PB_FIELDS.forEach((field) => formData.set(field, pbs[field]));
      displayedPbs.forEach((field) => formData.append("displayedPbs", field));
    } else if (verificationRequested) {
      formData.set("verificationRequested", "on");
    }
    if (isPrivate) formData.set("isPrivate", "on");
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <fieldset>
        <legend className="text-sm font-medium">I'm signing up as...</legend>
        <div className="mt-2 flex gap-4">
          {ACCOUNT_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="accountType"
                checked={accountType === type}
                onChange={() => setAccountType(type)}
              />
              {type === "ATHLETE" ? "An athlete" : "An affiliate / gym"}
            </label>
          ))}
        </div>
        {!isAthlete && (
          <p className="mt-1 text-xs text-b2b-ink/50">
            Affiliate accounts skip the athlete-only fields below (ability level, PBs, workout log,
            relationship status) — just the basics, plus which gym you run.
          </p>
        )}
      </fieldset>

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
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="rounded-full border border-b2b-purple/20 px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink"
          >
            📷 Change photo
          </button>
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

      {isAthlete && (
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
      )}

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
          {isAthlete ? "Affiliate gym" : "Which gym do you run?"}
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
          {gymOptions.map((gym) => (
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

      {isAthlete && (
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
      )}

      <div>
        <span className="block text-sm font-medium">{isAthlete ? "CrossFitting since" : "Established"}</span>
        <div className="mt-1 grid grid-cols-2 gap-4">
          <select
            aria-label={isAthlete ? "Month started CrossFit" : "Month established"}
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
            aria-label={isAthlete ? "Year started CrossFit" : "Year established"}
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

      {isAthlete && (
        <>
          <fieldset>
            <legend className="text-sm font-medium">Key PBs (kg)</legend>
            <p className="mt-0.5 text-xs text-b2b-ink/50">
              Fill in as many benchmark movements as you like — choose up to {MAX_DISPLAYED_PBS} to feature on
              your profile ({displayedPbs.length}/{MAX_DISPLAYED_PBS} featured).
            </p>

            {displayedPbs.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {displayedPbs.map((field) => (
                  <div key={field} className="relative">
                    <button
                      type="button"
                      onClick={() => removeDisplayedPb(field)}
                      aria-label={`Remove ${PB_LABELS[field]}`}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600 hover:bg-gray-300"
                    >
                      ×
                    </button>
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
            )}

            <button
              type="button"
              onClick={() => setShowAddMorePbs((v) => !v)}
              className="mt-3 text-sm font-medium text-b2b-pink hover:underline"
            >
              {showAddMorePbs ? "Hide other movements" : "+ Add more movements"}
            </button>

            {showAddMorePbs && (
              <div className="mt-3 flex flex-col gap-4 rounded border border-gray-200 p-3">
                {atMaxDisplayedPbs && (
                  <p className="text-xs text-amber-600">
                    You've featured {MAX_DISPLAYED_PBS} — remove one above to feature another. You can still fill
                    these in either way.
                  </p>
                )}
                {PB_CATEGORIES.map((category) => {
                  const available = category.fields.filter((field) => !displayedPbs.includes(field));
                  if (available.length === 0) return null;
                  return (
                    <div key={category.label}>
                      <p className="text-xs font-semibold text-gray-500">{category.label}</p>
                      <div className="mt-1 flex flex-col gap-2">
                        {available.map((field) => (
                          <div key={field} className="flex items-center gap-2">
                            <label htmlFor={field} className="flex-1 text-sm">
                              {PB_LABELS[field]}
                            </label>
                            <input
                              id={field}
                              type="number"
                              step="0.5"
                              min={0}
                              value={pbs[field]}
                              onChange={(e) => setPbs((prev) => ({ ...prev, [field]: e.target.value }))}
                              className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => addDisplayedPb(field)}
                              disabled={atMaxDisplayedPbs}
                              className="whitespace-nowrap rounded-full border border-b2b-pink/30 px-2.5 py-1 text-xs font-medium text-b2b-pink hover:bg-b2b-pink/10 disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                              Feature
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                if (e.target.value !== "true") setShowSingleBadge(false);
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

            {isSingle === "true" && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSingleBadge}
                  onChange={(e) => setShowSingleBadge(e.target.checked)}
                />
                Show a single badge (💚) on my profile photo
              </label>
            )}
          </div>
        </>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        Private profile (new followers will need to be approved)
      </label>

      {!isAthlete && (
        <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3">
          {initial.isVerified ? (
            <p className="text-sm text-b2b-ink/70">
              ✓ <span className="font-medium">Verified</span> as the owner/manager of this affiliate.
            </p>
          ) : (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={verificationRequested}
                onChange={(e) => setVerificationRequested(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Request verification as the legitimate owner/manager of this affiliate
                {verificationRequested && " — pending admin review"}.
              </span>
            </label>
          )}
        </div>
      )}

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
