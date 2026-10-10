import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { BackLink } from "@/components/BackLink";

export default async function DangerZoneSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/settings" className="mt-6">Settings</BackLink>

      <div className="mt-4">
        <SectionCard title="Danger Zone">
          <DeleteAccountForm />
        </SectionCard>
      </div>
    </main>
  );
}
