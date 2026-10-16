"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  GENDERS,
  PB_FIELDS,
  type AccountTypeOption,
  type GenderOption,
  type LevelOption,
  type LookingForOption,
  type PbField,
} from "@/lib/validation";
import { GENDER_LABELS } from "@/lib/labels";
import { OTHER_GYM } from "@/lib/gyms";
import { COUNTRIES, type Country } from "@/lib/countries";
import { AvatarCropper } from "@/components/AvatarCropper";
import { calculateAge } from "@/lib/age";

type Initial = {
  name: string;
  photo: string | null;
  accountType: AccountTypeOption;
  website: string;
  bio: string;
  dateOfBirth: string;
  gender: GenderOption | "";
  area: string;
  country: Country | "";
  affiliateGym: string;
  affiliateGymOther: string;
  showAge: boolean;
  isPrivate: boolean;
  verificationRequested: boolean;
  isVerified: boolean;
  // Not edited on this page — see the comment on PersonalInfoPage. Carried
  // through to the submit payload unchanged, since PATCH /api/profile
  // replaces a user's whole profile each time, not just the fields a given
  // page happens to render.
  levels: LevelOption[];
  openLevel: number | null;
  crossfitSinceYear: number | "";
  crossfitSinceMonth: number | "";
  lookingFor: LookingForOption[];
  isSingle: boolean | null;
  showRelationshipStatus: boolean;
  showSingleBadge: boolean;
  pbs: Record<PbField, number | "">;
  displayedPbs: PbField[];
};

export function PersonalInfoForm({ initial, gymOptions }: { initial: Initial; gymOptions: string[] }) {
  const router = useRouter();

  const isAthlete = initial.accountType === "ATHLETE";

  const [name, setName] = useState(initial.name);
  const [website, setWebsite] = useState(initial.website);
  const [verificationRequested, setVerificationRequested] = useState(initial.verificationRequested);
  const [bio, setBio] = useState(initial.bio);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [gender, setGender] = useState(initial.gender);
  const [area, setArea] = useState(initial.area);
  const [country, setCountry] = useState(initial.country);
  const [affiliateGym, setAffiliateGym] = useState(initial.affiliateGym);
  const [affiliateGymOther, setAffiliateGymOther] = useState(initial.affiliateGymOther);
  const isOtherGym = affiliateGym === OTHER_GYM;
  const [showAge, setShowAge] = useState(initial.showAge);
  const [isPrivate, setIsPrivate] = useState(initial.isPrivate);
  // Editable here for an AFFILIATE account ("Established" below) — this is
  // the only page an affiliate ever sees, so it can't live on the
  // athlete-only Ability page. For an ATHLETE it's carried through
  // unchanged instead, since "CrossFitting since" lives on that page.
  const [crossfitSinceYear, setCrossfitSinceYear] = useState(String(initial.crossfitSinceYear));
  const [crossfitSinceMonth, setCrossfitSinceMonth] = useState(String(initial.crossfitSinceMonth));
  // Carried through unchanged — see the Initial type above.
  const [levels] = useState<LevelOption[]>(initial.levels);
  const [openLevel] = useState(initial.openLevel ? String(initial.openLevel) : "");
  const [lookingFor] = useState<LookingForOption[]>(initial.lookingFor);
  const [isSingle] = useState(initial.isSingle === null ? "" : String(initial.isSingle));
  const [showRelationshipStatus] = useState(initial.showRelationshipStatus);
  const [showSingleBadge] = useState(initial.showSingleBadge);
  const [pbs] = useState<Record<PbField, string>>(
    Object.fromEntries(PB_FIELDS.map((field) => [field, String(initial.pbs[field])])) as Record<PbField, string>
  );
  const [displayedPbs] = useState<PbField[]>(initial.displayedPbs);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photo);
  // Set while a just-picked photo is awaiting reposition/zoom in the
  // cropper — separate from photoPreview, which only ever holds the final,
  // already-cropped result.
  const [cropSource, setCropSource] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) setCropSource(URL.createObjectURL(file));
    // Reset so picking the same file again (e.g. after cancelling the
    // cropper) still fires this handler.
    e.target.value = "";
  }

  function handleCropCancel() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

  function handleCropped(blob: Blob) {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(blob));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    if (isAthlete) formData.set("name", name);
    formData.set("accountType", initial.accountType);
    formData.set("bio", bio);
    formData.set("area", area);
    formData.set("country", country);
    formData.set("affiliateGym", affiliateGym);
    formData.set("affiliateGymOther", affiliateGymOther);
    formData.set("crossfitSinceYear", crossfitSinceYear);
    formData.set("crossfitSinceMonth", crossfitSinceMonth);
    if (isAthlete) {
      formData.set("dateOfBirth", dateOfBirth);
      formData.set("gender", gender);
      levels.forEach((v) => formData.append("levels", v));
      formData.set("openLevel", openLevel);
      lookingFor.forEach((v) => formData.append("lookingFor", v));
      formData.set("isSingle", isSingle);
      if (showRelationshipStatus) formData.set("showRelationshipStatus", "on");
      if (showSingleBadge) formData.set("showSingleBadge", "on");
      if (showAge) formData.set("showAge", "on");
      PB_FIELDS.forEach((field) => formData.set(field, pbs[field]));
      displayedPbs.forEach((field) => formData.append("displayedPbs", field));
    } else {
      formData.set("website", website);
      if (verificationRequested) formData.set("verificationRequested", "on");
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

    router.push("/profile/edit");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {cropSource && (
        <AvatarCropper imageSrc={cropSource} onCancel={handleCropCancel} onCropped={handleCropped} />
      )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <fieldset>
        <legend className="text-sm font-medium">Account type</legend>
        <p className="mt-2 text-sm text-b2b-ink">
          {isAthlete ? "Athlete" : "Affiliate / gym"}
          <span className="ml-2 text-xs text-b2b-ink/40">(set at signup — can&apos;t be changed)</span>
        </p>
      </fieldset>

      <div>
        <label className="block text-sm font-medium">Photo</label>
        <p className="mt-0.5 text-xs text-b2b-ink/50">The full-width photo at the top of your profile.</p>
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

      {isAthlete ? (
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
      ) : (
        <p className="text-xs text-b2b-ink/50">
          Your profile&apos;s name is whichever gym you select below — no need to type it separately.
        </p>
      )}

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
            <label htmlFor="dateOfBirth" className="block text-sm font-medium">
              Date of birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
            {dateOfBirth && !Number.isNaN(new Date(dateOfBirth).getTime()) && (
              <p className="mt-1 text-xs text-b2b-ink/40">
                That makes you {calculateAge(new Date(dateOfBirth))} — kept up to date automatically, no need to
                update it yourself each year.
              </p>
            )}
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
            <p className="mt-1 text-xs text-b2b-ink/50">
              Used for search &amp; discovery matching only — never shown on your profile.
            </p>
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
        <label htmlFor="country" className="block text-sm font-medium">
          Country
        </label>
        <select
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value as Country | "")}
          className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
        >
          <option value="">Prefer not to say / unset</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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

      {!isAthlete && (
        <>
          <div>
            <label htmlFor="website" className="block text-sm font-medium">
              Website <span className="font-normal text-b2b-ink/50">(optional)</span>
            </label>
            <input
              id="website"
              type="url"
              placeholder="https://yourgym.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
            <p className="mt-1 text-xs text-b2b-ink/50">Shown as a button on your profile.</p>
          </div>

          <div>
            <span className="block text-sm font-medium">Established</span>
            <div className="mt-1 grid grid-cols-2 gap-4">
              <select
                aria-label="Month established"
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
                aria-label="Year established"
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
        </>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
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
        {submitting ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
