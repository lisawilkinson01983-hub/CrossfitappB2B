import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { DeleteAccountForm } from "./DeleteAccountForm";

export default async function DangerZoneSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar title="Danger Zone" back={{ href: "/settings", label: "Settings" }} />

      <div className="mt-4">
        <SectionCard>
          <DeleteAccountForm />
        </SectionCard>
      </div>
    </main>
  );
}
