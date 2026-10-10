import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventSubmitForm } from "@/components/EventSubmitForm";
import { BackLink } from "@/components/BackLink";

export default async function SubmitEventPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const approvedGyms = await prisma.gym.findMany({
    where: { status: "APPROVED" },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const gymOptions = approvedGyms.map((g) => g.name);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href="/discover?view=events" className="mt-6">Back to events</BackLink>

      <div className="mt-4">
        <SectionCard title="Submit an event">
          <EventSubmitForm gymOptions={gymOptions} />
        </SectionCard>
      </div>
      <p className="mt-3 text-center text-sm text-b2b-ink/40">
        Track the status of what you've submitted under{" "}
        <Link href="/settings/events" className="text-b2b-pink underline">
          Settings → Event submissions
        </Link>
        .
      </p>
    </main>
  );
}
