import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Shared chrome for standalone legal/policy pages (Terms, Privacy,
 * Guidelines) — deliberately not the logged-in NavBar, since these pages
 * need to work for a signed-out visitor reading them before they sign up.
 */
export function LegalPageLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <Logo size="sm" href="/" />

      <Link href="/" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back
      </Link>

      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-b2b-ink/40">Last updated {updatedAt}</p>

      <div className="mt-6 rounded-lg border border-b2b-purple/20 bg-b2b-purple/5 p-4 text-sm text-b2b-ink/70">
        This is a draft written to cover the basics before real-user testing. It has not been
        reviewed by a lawyer — have one look it over (and adapt it for your country/state) before
        relying on it.
      </div>

      <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-b2b-ink/80">{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-base font-semibold text-b2b-ink">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
