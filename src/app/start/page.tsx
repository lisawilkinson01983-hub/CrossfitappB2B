import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function StartPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-b2b-bg px-4 text-center text-b2b-ink">
      <Logo size="lg" />
      <p className="mt-4 text-lg text-b2b-ink/60">Connecting CrossFit Athletes</p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/mission"
          className="rounded bg-b2b-pink px-4 py-3 font-medium text-white hover:bg-b2b-pink-dark"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded border border-b2b-purple/20 px-4 py-3 font-medium text-b2b-ink hover:bg-b2b-card"
        >
          I already have an account
        </Link>
      </div>
    </main>
  );
}
