import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { ComposeForm } from "./ComposeForm";

export default async function NewMessagePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">New message</h1>
      <div className="mt-6">
        <SectionCard title="Who's this for?">
          <ComposeForm />
        </SectionCard>
      </div>
    </main>
  );
}
