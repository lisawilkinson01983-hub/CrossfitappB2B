import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function MissionPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-b2b-violet px-4 text-center text-white">
      <Logo size="sm" />

      <h1 className="mt-8 text-3xl font-normal">Why Box 2 Box?</h1>
      <p className="mt-4 max-w-md text-white/80">
        CrossFit is bigger than any one box. Box 2 Box connects you with athletes across
        every affiliate near you — training partners, friends, or something more —
        wherever you call home.
      </p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/signup"
          className="rounded bg-b2b-pink px-4 py-3 font-medium text-white hover:bg-b2b-pink-dark"
        >
          Continue
        </Link>
        <Link href="/login" className="text-sm text-white/70 hover:text-white hover:underline">
          I already have an account
        </Link>
      </div>
    </main>
  );
}
