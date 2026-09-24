"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type DuplicateMatch = { id: string; name: string; address: string | null };

export type GymFormInitial = {
  name: string;
  address: string;
  websiteUrl: string;
  description: string;
  photo: string | null;
};

/** Used both to submit a new affiliate for review, and (mode="edit") for an admin editing an existing one directly. */
export function GymSubmitForm({
  mode = "create",
  gymId,
  initial,
  nameLocked = false,
}: {
  mode?: "create" | "edit";
  gymId?: string;
  initial?: GymFormInitial;
  /** True when this is one of the app's fixed affiliate gyms — renaming it here would orphan it, since other parts of the app match on this exact name. */
  nameLocked?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [postcode, setPostcode] = useState("");
  const [postcodeBusy, setPostcodeBusy] = useState(false);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.photo ?? null);
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
    setAddress(body.location);
  }

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Not useful in edit mode — the affiliate being edited would just flag itself.
  useEffect(() => {
    if (mode === "edit" || !name.trim()) {
      setDuplicates([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const params = new URLSearchParams({ name });
      const res = await fetch(`/api/gyms/check-duplicate?${params}`);
      if (res.ok) {
        const body = await res.json();
        setDuplicates(body.matches ?? []);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [mode, name]);

  const duplicateKey = duplicates.map((m) => m.id).join(",");
  const showDuplicateWarning = duplicates.length > 0 && dismissedKey !== duplicateKey;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create" && !image) {
      setError("An affiliate image is required");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("address", address);
    formData.set("websiteUrl", websiteUrl);
    formData.set("description", description);
    if (image) formData.set("image", image);

    const res = await fetch(mode === "edit" ? `/api/gyms/${gymId}` : "/api/gyms/submit", {
      method: mode === "edit" ? "PATCH" : "POST",
      body: formData,
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    if (mode === "edit") {
      // The name (which the detail/edit URLs are keyed on) may have just
      // changed — go to the affiliate's current URL rather than refreshing
      // this one, which would 404 once the old name no longer matches.
      router.push(`/gyms/${encodeURIComponent(name)}`);
      return;
    }

    setName("");
    setAddress("");
    setPostcode("");
    setPostcodeError(null);
    setWebsiteUrl("");
    setDescription("");
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
          {mode === "edit"
            ? "Affiliate updated."
            : 'Submitted — it\'ll appear once a moderator reviews it. Check "Your submissions" below for its status.'}
        </p>
      )}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Affiliate name
        </label>
        <input
          id="name"
          type="text"
          required
          disabled={nameLocked}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none disabled:bg-gray-100 disabled:text-b2b-ink/50"
        />
        {nameLocked && (
          <p className="mt-1 text-xs text-b2b-ink/40">
            This is one of the app's fixed affiliate gyms and can't be renamed here.
          </p>
        )}
      </div>

      {showDuplicateWarning && (
        <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          <p className="font-medium">This looks similar to an affiliate already listed:</p>
          <ul className="mt-1 list-disc pl-5">
            {duplicates.map((m) => (
              <li key={m.id}>
                {m.name}
                {m.address ? ` — ${m.address}` : ""}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDismissedKey(duplicateKey)}
            className="mt-2 text-sm font-medium text-yellow-900 underline"
          >
            This is a different affiliate — continue anyway
          </button>
        </div>
      )}

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
        <label htmlFor="address" className="block text-sm font-medium">
          Address
        </label>
        <input
          id="address"
          type="text"
          required={mode === "create"}
          placeholder="Unit, street, town, postcode"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full min-w-0 rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
        <p className="mt-1 text-xs text-b2b-ink/40">
          Filled in from the postcode above — edit it if you'd like to add a unit number.
        </p>
      </div>

      <div>
        <label htmlFor="websiteUrl" className="block text-sm font-medium">
          Affiliate website
        </label>
        <input
          id="websiteUrl"
          type="url"
          required={mode === "create"}
          placeholder="https://..."
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Affiliate information
        </label>
        <textarea
          id="description"
          required={mode === "create"}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Affiliate image</label>
        <div className="mt-2 flex items-center gap-4">
          {imagePreview ? (
            <Image
              src={imagePreview}
              alt="Affiliate image preview"
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
        {submitting ? "Saving..." : mode === "edit" ? "Save changes" : "Submit affiliate"}
      </button>
    </form>
  );
}
