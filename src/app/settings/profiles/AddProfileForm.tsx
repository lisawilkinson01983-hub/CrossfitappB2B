"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type AccountType = "ATHLETE" | "AFFILIATE";

export function AddProfileForm() {
  const router = useRouter();
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("ATHLETE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const createRes = await fetch("/api/account/add-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, accountType }),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      setError(created.error ?? "Couldn't create that profile. Please try again.");
      setSubmitting(false);
      return;
    }

    const switchRes = await fetch("/api/account/switch-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: created.profile.id }),
    });
    if (!switchRes.ok) {
      setError("Profile created, but switching to it failed. Find it under Your profiles above.");
      setSubmitting(false);
      router.refresh();
      return;
    }

    await update({ switchToProfileId: created.profile.id });
    router.push("/profile/edit");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
      >
        Add a profile
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-b2b-ink/50">
        This creates a brand new profile under your existing login — its own posts, followers, and feed presence,
        separate from your other profile(s). You'll finish setting it up right after.
      </p>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {accountType === "ATHLETE" ? (
        <input
          type="text"
          placeholder="Name for this profile"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      ) : (
        <p className="text-xs text-b2b-ink/50">
          You'll pick which gym you run (and that becomes the profile's name) on the next screen.
        </p>
      )}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="accountType"
            checked={accountType === "ATHLETE"}
            onChange={() => setAccountType("ATHLETE")}
          />
          Athlete
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="accountType"
            checked={accountType === "AFFILIATE"}
            onChange={() => setAccountType("AFFILIATE")}
          />
          Affiliate
        </label>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create profile"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="rounded px-4 py-2 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
