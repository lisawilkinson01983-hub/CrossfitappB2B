import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { ChangeEmailForm } from "./ChangeEmailForm";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Settings
      </Link>

      <div className="mt-4">
        <SectionCard
          title="Account"
          action={
            <Link href="/profile/edit" className="text-sm text-b2b-pink underline">
              Edit your profile
            </Link>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Change email</h3>
              <div className="mt-2">
                <ChangeEmailForm />
              </div>
            </div>

            <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">Change password</h3>
              <div className="mt-2">
                <ChangePasswordForm />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
