"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AvatarCropper } from "@/components/AvatarCropper";
import { BackIcon } from "@/components/BackIcon";
import { LEVELS, LOOKING_FOR_OPTIONS, MAX_LEVELS, type LevelOption, type LookingForOption } from "@/lib/validation";
import { LEVEL_LABELS, LOOKING_FOR_LABELS } from "@/lib/labels";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";
import {
  CompetitionStatsEditor,
  communityCupResultRowsToPayload,
  openResultRowsToPayload,
  type CommunityCupResultRow,
  type OpenResultRow,
} from "@/components/CompetitionStatsEditor";

type AccountType = "ATHLETE" | "AFFILIATE";

type GymMatch = { id: string; name: string; address: string | null; photo: string | null };
type PlaceMatch = { label: string; lat: number; lng: number };

export type ProfileSetupInitial = {
  accountType: AccountType;
  name: string;
  photo: string | null;
  dateOfBirth: string;
  bio: string;
  area: string;
  affiliateGym: string;
  affiliateGymOther: string;
  levels: LevelOption[];
  openLevel: number | null;
  lookingFor: LookingForOption[];
};

const ATHLETE_STEPS = ["type", "basics", "location", "ability", "competitionStats", "lookingFor", "review"] as const;
const AFFILIATE_STEPS = ["type", "basics", "location", "review"] as const;
type StepId = (typeof ATHLETE_STEPS)[number];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function ProfileSetupWizard({ initial }: { initial: ProfileSetupInitial }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  const [accountType, setAccountType] = useState<AccountType>(initial.accountType);
  const [firstName, setFirstName] = useState(initial.name.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(initial.name.split(" ").slice(1).join(" "));
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [bio, setBio] = useState(initial.bio);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photo);
  const [cropSource, setCropSource] = useState<string | null>(null);

  const [area, setArea] = useState(initial.area);
  const [areaSuggestions, setAreaSuggestions] = useState<PlaceMatch[]>([]);
  const [areaFocused, setAreaFocused] = useState(false);
  const debouncedArea = useDebouncedValue(area, 400);

  const isKnownSentinel = initial.affiliateGym === UNAFFILIATED || initial.affiliateGym === OTHER_GYM || !initial.affiliateGym;
  const [unaffiliated, setUnaffiliated] = useState(initial.affiliateGym === UNAFFILIATED);
  const [showOtherGym, setShowOtherGym] = useState(initial.affiliateGym === OTHER_GYM);
  const [otherGymName, setOtherGymName] = useState(initial.affiliateGymOther);
  const [gymQuery, setGymQuery] = useState(isKnownSentinel ? "" : initial.affiliateGym);
  const [gymSelected, setGymSelected] = useState(isKnownSentinel ? "" : initial.affiliateGym);
  const [gymSuggestions, setGymSuggestions] = useState<GymMatch[]>([]);
  const debouncedGymQuery = useDebouncedValue(gymQuery, 350);

  const [levels, setLevels] = useState<LevelOption[]>(initial.levels);
  const [openLevel, setOpenLevel] = useState<number | null>(initial.openLevel);
  const [lookingFor, setLookingFor] = useState<LookingForOption[]>(initial.lookingFor);

  // Fully optional and skippable — empty by default rather than seeded with
  // one blank row, so "nothing here" reads as "skipped" rather than "an
  // empty row waiting to be deleted".
  const [openResultRows, setOpenResultRows] = useState<OpenResultRow[]>([]);
  const [communityCupResultRows, setCommunityCupResultRows] = useState<CommunityCupResultRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const gymRequestId = useRef(0);
  const areaRequestId = useRef(0);

  useEffect(() => {
    if (gymSelected || debouncedGymQuery.trim().length < 2) {
      setGymSuggestions([]);
      return;
    }
    const requestId = ++gymRequestId.current;
    fetch(`/api/gyms/search-suggest?q=${encodeURIComponent(debouncedGymQuery)}`)
      .then((res) => (res.ok ? res.json() : { matches: [] }))
      .then((body) => {
        if (requestId === gymRequestId.current) setGymSuggestions(body.matches ?? []);
      })
      .catch(() => {});
  }, [debouncedGymQuery, gymSelected]);

  useEffect(() => {
    if (debouncedArea.trim().length < 3) {
      setAreaSuggestions([]);
      return;
    }
    const requestId = ++areaRequestId.current;
    fetch(`/api/geocode/search-suggest?q=${encodeURIComponent(debouncedArea)}`)
      .then((res) => (res.ok ? res.json() : { matches: [] }))
      .then((body) => {
        if (requestId === areaRequestId.current) setAreaSuggestions(body.matches ?? []);
      })
      .catch(() => {});
  }, [debouncedArea]);

  const steps: readonly StepId[] = accountType === "AFFILIATE" ? AFFILIATE_STEPS : ATHLETE_STEPS;
  const step = steps[stepIndex];

  const gymOk = unaffiliated || !!gymSelected || (showOtherGym && otherGymName.trim().length > 0);
  const basicsOk = accountType === "AFFILIATE" || (firstName.trim().length > 0 && lastName.trim().length > 0 && dateOfBirth.length > 0);
  const locationOk = area.trim().length > 0 && gymOk;
  const abilityOk = levels.length > 0;
  const lookingForOk = lookingFor.length > 0;

  const canAdvance =
    step === "type" ? true : step === "basics" ? basicsOk : step === "location" ? locationOk : step === "ability" ? abilityOk : step === "lookingFor" ? lookingForOk : true;

  function goNext() {
    if (!canAdvance) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropSource(URL.createObjectURL(file));
    e.target.value = "";
  }
  function handleCropped(blob: Blob) {
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(blob));
    setCropSource(null);
  }

  function selectGym(match: GymMatch) {
    setGymSelected(match.name);
    setGymQuery(match.name);
    setShowOtherGym(false);
  }
  function clearGym() {
    setGymSelected("");
    setGymQuery("");
  }
  function toggleUnaffiliated() {
    const next = !unaffiliated;
    setUnaffiliated(next);
    if (next) {
      clearGym();
      setShowOtherGym(false);
    }
  }
  function toggleLevel(level: LevelOption) {
    setLevels((prev) => {
      if (prev.includes(level)) return prev.filter((l) => l !== level);
      if (prev.length >= MAX_LEVELS) return prev;
      return [...prev, level];
    });
  }
  function toggleLookingFor(option: LookingForOption) {
    setLookingFor((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  async function handleCreateProfile() {
    setSubmitting(true);
    setSubmitError(null);

    const formData = new FormData();
    if (accountType === "ATHLETE") {
      formData.set("name", `${firstName.trim()} ${lastName.trim()}`.trim());
      formData.set("dateOfBirth", dateOfBirth);
      for (const level of levels) formData.append("levels", level);
      if (openLevel) formData.set("openLevel", String(openLevel));
      for (const option of lookingFor) formData.append("lookingFor", option);
    }
    formData.set("accountType", accountType);
    formData.set("bio", bio);
    formData.set("area", area);
    formData.set(
      "affiliateGym",
      unaffiliated ? UNAFFILIATED : showOtherGym ? OTHER_GYM : gymSelected
    );
    if (showOtherGym) formData.set("affiliateGymOther", otherGymName);
    if (photoFile) formData.set("photo", photoFile);

    const res = await fetch("/api/profile", { method: "PATCH", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    fetch("/api/account/onboarding-seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "welcome" }),
    }).catch(() => {});

    const openResults = openResultRowsToPayload(openResultRows);
    const communityCupResults = communityCupResultRowsToPayload(communityCupResultRows);
    if (openResults.length || communityCupResults.length) {
      // Best-effort — the profile itself is already created, so a hiccup
      // here shouldn't block onboarding; the same data can be re-entered
      // from Settings → Edit profile.
      fetch("/api/profile/competition-stats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openResults, communityCupResults }),
      }).catch(() => {});
    }

    router.push("/feed");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-5 pb-8">
      {cropSource && (
        <AvatarCropper imageSrc={cropSource} onCancel={() => setCropSource(null)} onCropped={handleCropped} />
      )}

      <div className="flex items-center gap-3">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-b2b-card text-b2b-ink"
          >
            <BackIcon className="h-4 w-4" />
          </button>
        ) : (
          <span className="h-8 w-8 shrink-0" />
        )}
        <div className="flex-1 text-center">
          <Image src="/logo-mark.png" alt="Box 2 Box" width={26} height={26} className="mx-auto" priority />
        </div>
        <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="shrink-0 text-xs text-b2b-ink/40 hover:underline">
          Log out
        </button>
      </div>

      <div className="mt-4 flex gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-b2b-pink" : "bg-b2b-card"}`} />
        ))}
      </div>

      <div className="mt-5 flex-1">
        <p className="font-display text-xs tracking-wide text-b2b-pink">
          STEP {stepIndex + 1} OF {steps.length}
        </p>

        {step === "type" && <TypeStep accountType={accountType} onSelect={setAccountType} />}

        {step === "basics" && (
          <BasicsStep
            accountType={accountType}
            firstName={firstName}
            lastName={lastName}
            dateOfBirth={dateOfBirth}
            bio={bio}
            photoPreview={photoPreview}
            onFirstName={setFirstName}
            onLastName={setLastName}
            onDateOfBirth={setDateOfBirth}
            onBio={setBio}
            onPhotoSelected={handlePhotoSelected}
          />
        )}

        {step === "location" && (
          <LocationStep
            accountType={accountType}
            area={area}
            areaSuggestions={areaSuggestions}
            onAreaChange={(v) => {
              setArea(v);
              setAreaFocused(true);
            }}
            onAreaFocus={() => setAreaFocused(true)}
            onAreaBlurSoon={() => setTimeout(() => setAreaFocused(false), 150)}
            areaFocused={areaFocused}
            onPickArea={(label) => {
              setArea(label);
              setAreaSuggestions([]);
              setAreaFocused(false);
            }}
            gymQuery={gymQuery}
            gymSelected={gymSelected}
            gymSuggestions={gymSuggestions}
            onGymQueryChange={(v) => {
              setGymQuery(v);
              setGymSelected("");
            }}
            onSelectGym={selectGym}
            onClearGym={clearGym}
            unaffiliated={unaffiliated}
            onToggleUnaffiliated={toggleUnaffiliated}
            showOtherGym={showOtherGym}
            onShowOtherGym={() => {
              setShowOtherGym(true);
              setGymSelected("");
              setGymSuggestions([]);
            }}
            otherGymName={otherGymName}
            onOtherGymName={setOtherGymName}
          />
        )}

        {step === "ability" && (
          <AbilityStep levels={levels} onToggle={toggleLevel} openLevel={openLevel} onOpenLevel={setOpenLevel} />
        )}

        {step === "competitionStats" && (
          <CompetitionStatsStep
            openResults={openResultRows}
            onOpenResultsChange={setOpenResultRows}
            communityCupResults={communityCupResultRows}
            onCommunityCupResultsChange={setCommunityCupResultRows}
          />
        )}

        {step === "lookingFor" && <LookingForStep lookingFor={lookingFor} onToggle={toggleLookingFor} />}

        {step === "review" && (
          <ReviewStep
            accountType={accountType}
            firstName={firstName}
            lastName={lastName}
            photoPreview={photoPreview}
            area={area}
            gymLabel={unaffiliated ? UNAFFILIATED : showOtherGym ? otherGymName : gymSelected}
            levels={levels}
            openLevel={openLevel}
            lookingFor={lookingFor}
            competitionStatsCount={
              openResultRowsToPayload(openResultRows).length + communityCupResultRowsToPayload(communityCupResultRows).length
            }
            error={submitError}
            onEditStep={(targetStep) => setStepIndex(steps.indexOf(targetStep))}
          />
        )}
      </div>

      <div className="mt-6">
        {step === "review" ? (
          <button
            type="button"
            onClick={handleCreateProfile}
            disabled={submitting}
            className="w-full rounded-xl bg-b2b-pink py-4 text-base font-bold text-white hover:bg-b2b-pink-dark disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create my profile"}
          </button>
        ) : (
          <>
            {step === "competitionStats" && (
              <button
                type="button"
                onClick={goNext}
                className="mb-2.5 block w-full text-center text-sm text-b2b-ink/50 underline"
              >
                Skip for now — I'll add this later
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!canAdvance}
              className="w-full rounded-xl bg-b2b-ink py-4 text-base font-bold text-b2b-bg disabled:opacity-35"
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TypeStep({
  accountType,
  onSelect,
}: {
  accountType: AccountType;
  onSelect: (t: AccountType) => void;
}) {
  return (
    <div>
      <h1 className="mt-2 text-2xl">Welcome to Box 2 Box.</h1>
      <p className="text-2xl">What brings you here?</p>
      <p className="mt-2 text-sm text-b2b-ink/50">
        This decides what the rest of your profile looks like.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <AccountTypeTile
          selected={accountType === "ATHLETE"}
          title="I'm an athlete"
          description="Find teammates, track PBs, follow events"
          onClick={() => onSelect("ATHLETE")}
        />
        <AccountTypeTile
          selected={accountType === "AFFILIATE"}
          title="I run a gym"
          description="List your box, post events, reach athletes"
          onClick={() => onSelect("AFFILIATE")}
        />
      </div>

      <div className="mt-4 flex gap-2.5 rounded-xl bg-b2b-card p-3.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-4 w-4 shrink-0 text-b2b-pink">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
        <p className="text-xs leading-relaxed text-b2b-ink/60">
          Not stuck with this — once your account's set up, you can add the other profile type too from Settings
          and switch between them.
        </p>
      </div>
    </div>
  );
}

function AccountTypeTile({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-colors ${
        selected ? "border-b2b-pink bg-b2b-pink/5" : "border-b2b-card bg-b2b-bg"
      }`}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-b2b-pink" : "bg-b2b-card"}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke={selected ? "white" : "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-b2b-purple">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-b2b-ink">{title}</p>
        <p className="text-sm text-b2b-ink/50">{description}</p>
      </div>
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-b2b-pink bg-b2b-pink" : "border-gray-300"}`}>
        {selected && (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" className="h-3 w-3">
            <path d="M4 12l5 5L20 6" />
          </svg>
        )}
      </div>
    </button>
  );
}

function BasicsStep({
  accountType,
  firstName,
  lastName,
  dateOfBirth,
  bio,
  photoPreview,
  onFirstName,
  onLastName,
  onDateOfBirth,
  onBio,
  onPhotoSelected,
}: {
  accountType: AccountType;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  bio: string;
  photoPreview: string | null;
  onFirstName: (v: string) => void;
  onLastName: (v: string) => void;
  onDateOfBirth: (v: string) => void;
  onBio: (v: string) => void;
  onPhotoSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <h1 className="mt-2 text-2xl">{accountType === "ATHLETE" ? "Put a face to the name." : "Add a photo."}</h1>
      <p className="mt-2 text-sm text-b2b-ink/50">
        {accountType === "ATHLETE" ? "This is what people see on the feed and in Discover." : "Your gym's photo on the feed and in Discover — add it now or later."}
      </p>

      <div className="mt-6 flex justify-center">
        <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-b2b-card">
          {photoPreview ? (
            <Image src={photoPreview} alt="" fill className="rounded-full object-cover" unoptimized />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-gray-400">
              <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
          <span className="absolute -right-0.5 -bottom-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white bg-b2b-ink text-b2b-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-3 w-3">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoSelected} className="hidden" />
        </label>
      </div>

      {accountType === "ATHLETE" && (
        <div className="mt-6 flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold text-b2b-purple">
              First name <span className="text-b2b-pink">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => onFirstName(e.target.value)}
              placeholder="First"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold text-b2b-purple">
              Last name <span className="text-b2b-pink">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => onLastName(e.target.value)}
              placeholder="Last"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-b2b-pink focus:outline-none"
            />
          </div>
        </div>
      )}

      {accountType === "ATHLETE" && (
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold text-b2b-purple">
            Date of birth <span className="text-b2b-pink">*</span>
          </label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => onDateOfBirth(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-b2b-pink focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-b2b-ink/40">Only shown on your profile if you choose to.</p>
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-bold text-b2b-purple">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => onBio(e.target.value.slice(0, 160))}
          placeholder="A line about your training, your goals, anything."
          rows={3}
          className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-b2b-pink focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-b2b-ink/30">{bio.length}/160</p>
      </div>
    </div>
  );
}

function LocationStep({
  accountType,
  area,
  areaSuggestions,
  areaFocused,
  onAreaChange,
  onAreaFocus,
  onAreaBlurSoon,
  onPickArea,
  gymQuery,
  gymSelected,
  gymSuggestions,
  onGymQueryChange,
  onSelectGym,
  onClearGym,
  unaffiliated,
  onToggleUnaffiliated,
  showOtherGym,
  onShowOtherGym,
  otherGymName,
  onOtherGymName,
}: {
  accountType: AccountType;
  area: string;
  areaSuggestions: PlaceMatch[];
  areaFocused: boolean;
  onAreaChange: (v: string) => void;
  onAreaFocus: () => void;
  onAreaBlurSoon: () => void;
  onPickArea: (label: string) => void;
  gymQuery: string;
  gymSelected: string;
  gymSuggestions: GymMatch[];
  onGymQueryChange: (v: string) => void;
  onSelectGym: (m: GymMatch) => void;
  onClearGym: () => void;
  unaffiliated: boolean;
  onToggleUnaffiliated: () => void;
  showOtherGym: boolean;
  onShowOtherGym: () => void;
  otherGymName: string;
  onOtherGymName: (v: string) => void;
}) {
  const gymDisabled = unaffiliated;
  return (
    <div>
      <h1 className="mt-2 text-2xl">Where do you train?</h1>
      <p className="mt-2 text-sm text-b2b-ink/50">
        We use this to show you nearby events and teammates — and to match you to your box.
      </p>

      <div className="mt-6">
        <label className="mb-1.5 block text-xs font-bold text-b2b-purple">
          Area <span className="text-b2b-pink">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={area}
            onChange={(e) => onAreaChange(e.target.value)}
            onFocus={onAreaFocus}
            onBlur={onAreaBlurSoon}
            placeholder="Town or postcode"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-b2b-pink focus:outline-none"
          />
          {areaFocused && areaSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-b2b-bg shadow-lg">
              {areaSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPickArea(s.label)}
                  className="block w-full truncate px-3.5 py-2.5 text-left text-sm hover:bg-b2b-card"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-bold text-b2b-purple">
          {accountType === "AFFILIATE" ? "Which gym do you run?" : "Home gym"}{" "}
          {!unaffiliated && <span className="text-b2b-pink">*</span>}
        </label>
        <div className="relative">
          <input
            type="text"
            value={gymQuery}
            disabled={gymDisabled}
            onChange={(e) => onGymQueryChange(e.target.value)}
            placeholder="Search for your box"
            className={`w-full rounded-xl border px-3.5 py-3 text-sm focus:border-b2b-pink focus:outline-none ${
              gymDisabled ? "border-gray-200 bg-b2b-card text-b2b-ink/30" : "border-gray-200"
            }`}
          />
          {!gymSelected && !showOtherGym && gymSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-b2b-bg shadow-lg">
              {gymSuggestions.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectGym(g)}
                  className="block w-full truncate px-3.5 py-2.5 text-left text-sm hover:bg-b2b-card"
                >
                  {g.name}
                  {g.address && <span className="text-b2b-ink/40"> · {g.address}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {gymSelected && (
          <p className="mt-1.5 text-xs text-b2b-pink">
            Selected · <button type="button" onClick={onClearGym} className="underline">change</button>
          </p>
        )}
        {!gymDisabled && !gymSelected && (
          <button type="button" onClick={onShowOtherGym} className="mt-1.5 text-xs text-b2b-ink/40 underline">
            Can't find it? Enter it manually
          </button>
        )}
        {showOtherGym && (
          <input
            type="text"
            value={otherGymName}
            onChange={(e) => onOtherGymName(e.target.value)}
            placeholder="Gym name"
            className="mt-2 w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-b2b-pink focus:outline-none"
          />
        )}

        {accountType === "ATHLETE" && (
          <button type="button" onClick={onToggleUnaffiliated} className="mt-3 flex items-start gap-2.5 text-left">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${unaffiliated ? "border-b2b-pink bg-b2b-pink" : "border-gray-300"}`}>
              {unaffiliated && (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" className="h-3 w-3">
                  <path d="M4 12l5 5L20 6" />
                </svg>
              )}
            </span>
            <span className="text-sm text-b2b-purple">I don't train at a gym / box — I'm unaffiliated</span>
          </button>
        )}
      </div>
    </div>
  );
}

function AbilityStep({
  levels,
  onToggle,
  openLevel,
  onOpenLevel,
}: {
  levels: LevelOption[];
  onToggle: (l: LevelOption) => void;
  openLevel: number | null;
  onOpenLevel: (v: number | null) => void;
}) {
  return (
    <div>
      <h1 className="mt-2 text-2xl">What's your level?</h1>
      <p className="mt-2 text-sm text-b2b-ink/50">
        Pick up to {MAX_LEVELS} — this is how teammate requests and workouts get matched to you.
      </p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        {LEVELS.map((level) => {
          const selected = levels.includes(level);
          return (
            <button
              key={level}
              type="button"
              onClick={() => onToggle(level)}
              className={`rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
                selected ? "border-b2b-pink bg-b2b-pink text-white" : "border-gray-200 text-b2b-purple"
              }`}
            >
              {LEVEL_LABELS[level]}
            </button>
          );
        })}
      </div>

      <h2 className="mt-8 text-base font-bold text-b2b-purple">Official CrossFit Open level (optional)</h2>
      <p className="mt-1 text-sm text-b2b-ink/50">
        Your most recent Open placement band, 1–10 — shown as a quick badge on your profile card. You can re-enter
        this every year once the new Open results are in.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onOpenLevel(openLevel === n ? null : n)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
              openLevel === n ? "border-b2b-pink bg-b2b-pink text-white" : "border-gray-200 text-b2b-purple"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompetitionStatsStep({
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
  return (
    <div>
      <h1 className="mt-2 text-2xl">Competition stats</h1>
      <p className="mt-2 text-sm text-b2b-ink/50">
        Got CrossFit Open or Community Cup results? Adding them helps us match you with teammates at a similar
        level — totally optional, and you can always come back to this from Settings → Edit profile.
      </p>
      <div className="mt-6">
        <CompetitionStatsEditor
          openResults={openResults}
          onOpenResultsChange={onOpenResultsChange}
          communityCupResults={communityCupResults}
          onCommunityCupResultsChange={onCommunityCupResultsChange}
        />
      </div>
    </div>
  );
}

function LookingForStep({ lookingFor, onToggle }: { lookingFor: LookingForOption[]; onToggle: (o: LookingForOption) => void }) {
  return (
    <div>
      <h1 className="mt-2 text-2xl">What are you here for?</h1>
      <p className="mt-2 text-sm text-b2b-ink/50">Pick as many as apply.</p>
      <div className="mt-6 flex flex-col gap-2.5">
        {LOOKING_FOR_OPTIONS.map((option) => {
          const selected = lookingFor.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left transition-colors ${
                selected ? "border-b2b-pink bg-b2b-pink/5" : "border-b2b-card"
              }`}
            >
              <span className="font-medium text-b2b-ink">{LOOKING_FOR_LABELS[option]}</span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-b2b-pink bg-b2b-pink" : "border-gray-300"}`}>
                {selected && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" className="h-3 w-3">
                    <path d="M4 12l5 5L20 6" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStep({
  accountType,
  firstName,
  lastName,
  photoPreview,
  area,
  gymLabel,
  levels,
  openLevel,
  lookingFor,
  competitionStatsCount,
  error,
  onEditStep,
}: {
  accountType: AccountType;
  firstName: string;
  lastName: string;
  photoPreview: string | null;
  area: string;
  gymLabel: string;
  levels: LevelOption[];
  openLevel: number | null;
  lookingFor: LookingForOption[];
  competitionStatsCount: number;
  error: string | null;
  onEditStep: (step: StepId) => void;
}) {
  const name = accountType === "ATHLETE" ? `${firstName} ${lastName}`.trim() : gymLabel || "Your gym";
  return (
    <div>
      <h1 className="mt-2 text-2xl">Review &amp; you're in.</h1>
      <p className="mt-2 text-sm text-b2b-ink/50">Nothing's saved yet — this is the moment your profile actually gets created.</p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex items-center gap-3.5 rounded-2xl bg-b2b-card p-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-amber-200 to-b2b-pink">
          {photoPreview && <Image src={photoPreview} alt="" fill className="object-cover" unoptimized />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-b2b-ink">{name || "—"}</p>
          <p className="text-sm text-b2b-ink/50">{accountType === "ATHLETE" ? "Athlete" : "Affiliate"}</p>
        </div>
      </div>

      <div className="mt-2 border-t border-gray-100">
        <ReviewRow label="Area" value={area} onEdit={() => onEditStep("location")} />
        <ReviewRow label="Gym" value={gymLabel || "—"} onEdit={() => onEditStep("location")} />
        {accountType === "ATHLETE" && (
          <>
            <ReviewRow label="Ability" value={levels.map((l) => LEVEL_LABELS[l]).join(", ") || "—"} onEdit={() => onEditStep("ability")} />
            <ReviewRow label="Open level" value={openLevel ? String(openLevel) : "—"} onEdit={() => onEditStep("ability")} />
            <ReviewRow
              label="Competition stats"
              value={competitionStatsCount > 0 ? `${competitionStatsCount} added` : "Skipped"}
              onEdit={() => onEditStep("competitionStats")}
            />
            <ReviewRow
              label="Looking for"
              value={lookingFor.map((o) => LOOKING_FOR_LABELS[o]).join(", ") || "—"}
              onEdit={() => onEditStep("lookingFor")}
            />
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-b2b-ink/40">You can edit any of this later from Settings.</p>
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 py-3.5">
      <span className="w-24 shrink-0 text-xs font-bold text-b2b-purple">{label}</span>
      <span className="flex-1 text-right text-sm text-b2b-ink">
        {value}
        <button type="button" onClick={onEdit} className="ml-2.5 text-xs text-b2b-pink underline">
          Edit
        </button>
      </span>
    </div>
  );
}
