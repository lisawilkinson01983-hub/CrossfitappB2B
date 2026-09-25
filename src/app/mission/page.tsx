import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function MissionPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-b2b-bg px-4 text-center text-b2b-ink">
      <Logo size="sm" />

      <h1 className="mt-8 text-3xl font-normal leading-tight">
        Every box.
        <br />
        One community.
      </h1>
      <p className="mt-4 max-w-md text-b2b-ink/60">
        Box 2 Box connects CrossFit athletes beyond their own affiliate, helping them find
        training partners, teammates, friends and maybe even something deeper.
      </p>
      <p className="mt-4 max-w-md text-b2b-ink/60">
        Share your wins, discover events, and build a network that doesn&apos;t stop at
        your gym&apos;s front door.
      </p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/signup"
          className="rounded bg-b2b-pink px-4 py-3 font-medium text-white hover:bg-b2b-pink-dark"
        >
          Continue
        </Link>
        <Link href="/login" className="text-sm text-b2b-pink underline">
          I already have an account
        </Link>
      </div>
    </main>
  );
}
