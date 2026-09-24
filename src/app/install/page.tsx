import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { OpenInstalledApp } from "./OpenInstalledApp";

// The page testers are sent to (Settings → Invite Friends links here). The
// app is installed first and signed up for inside it, not in the browser:
// on iPhone a home-screen app doesn't share Safari's login, so signing up in
// Safari first would just mean logging in all over again.
export default async function InstallPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const code = ref && /^[A-Za-z0-9]{4,12}$/.test(ref) ? ref.toUpperCase() : null;
  const session = await getServerSession(authOptions);
  const appTarget = session?.user?.id ? "/feed" : code ? `/signup?ref=${code}` : "/start";

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-8">
      <OpenInstalledApp target={appTarget} />
      <Logo size="md" href="/" />

      <h1 className="mt-6 text-2xl font-bold">Get the Box 2 Box app</h1>
      <p className="mt-2 text-sm text-b2b-ink/60">
        Add it to your home screen and it works just like an app: its own icon, full screen, no
        browser bars. It takes about 30 seconds.
      </p>

      {code && (
        <div className="mt-6 rounded-xl border border-b2b-pink/30 bg-b2b-card p-4 text-center">
          <p className="text-sm text-b2b-ink/60">Your invite code — you&apos;ll need it to sign up</p>
          <p className="mt-1 font-mono text-2xl tracking-widest">{code}</p>
        </div>
      )}

      <section className="mt-6 rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
        <h2 className="font-semibold">iPhone</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-b2b-ink/80">
          <li>
            Open this page in <strong>Safari</strong> (other browsers on iPhone can&apos;t always add
            apps).
          </li>
          <li>
            Tap the <strong>Share</strong> button — the square with an arrow pointing up, at the bottom of
            the screen.
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
          <li>Open Box 2 Box from your home screen and sign up.</li>
        </ol>
      </section>

      <section className="mt-4 rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
        <h2 className="font-semibold">Android</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-b2b-ink/80">
          <li>
            Open this page in <strong>Chrome</strong>.
          </li>
          <li>
            Tap the <strong>⋮</strong> menu at the top right.
          </li>
          <li>
            Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>), then{" "}
            <strong>Install</strong>.
          </li>
          <li>Open Box 2 Box from your home screen and sign up.</li>
        </ol>
      </section>

      <p className="mt-6 text-sm text-b2b-ink/60">
        On a computer, or just want to look first?{" "}
        <Link href={code ? `/signup?ref=${code}` : "/signup"} className="text-b2b-pink underline">
          Sign up in the browser
        </Link>
        .
      </p>
    </main>
  );
}
