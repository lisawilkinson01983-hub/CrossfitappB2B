"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Prefills from a shared invite link (e.g. /signup?ref=ABCD1234) — plain
  // client-side read so this component doesn't need a Suspense boundary.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setInviteCode(ref);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      return;
    }
    if (!confirmedAge) {
      setError("You must confirm you're at least 18 years old");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        agreedToTerms,
        confirmedAge,
        inviteCode: inviteCode.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });

    setSubmitting(false);

    if (!result || result.error) {
      setError("Account created, but automatic login failed. Please log in.");
      router.push("/login");
      return;
    }

    router.push("/profile/edit");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
      </div>

      <div>
        <label htmlFor="inviteCode" className="block text-sm font-medium">
          Invite code <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input
          id="inviteCode"
          type="text"
          autoCapitalize="characters"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 uppercase focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={confirmedAge}
            onChange={(e) => setConfirmedAge(e.target.checked)}
            className="mt-0.5"
          />
          I confirm I'm at least 18 years old.
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-b2b-pink underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-b2b-pink underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting || !agreedToTerms || !confirmedAge}
        className="rounded bg-b2b-pink px-4 py-2 font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {submitting ? "Creating account..." : "Sign up"}
      </button>
    </form>
  );
}
