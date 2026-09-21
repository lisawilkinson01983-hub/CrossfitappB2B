import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function WelcomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-b2b-violet px-4 text-center text-white">
      <Logo size="lg" />
      <p className="mt-4 text-lg text-white/80">Connecting CrossFit Athletes</p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/mission"
          className="rounded bg-b2b-pink px-4 py-3 font-medium text-white hover:bg-b2b-pink-dark"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded border border-white/30 px-4 py-3 font-medium text-white hover:bg-b2b-card/10"
        >
          I already have an account
        </Link>
      </div>
    </main>
  );
}
