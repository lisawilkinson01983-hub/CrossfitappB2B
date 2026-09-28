import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";

export default async function LegalSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Settings
      </Link>

      <div className="mt-4">
        <SectionCard title="Legal">
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/terms" className="text-b2b-pink underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-b2b-pink underline">
              Privacy Policy
            </Link>
            <Link href="/guidelines" className="text-b2b-pink underline">
              Community Guidelines
            </Link>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
