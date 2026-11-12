import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { getGymWodWeek } from "@/lib/gymSuggestion";
import { PB_FIELDS, type PbField } from "@/lib/validation";
import { LogEntryChoice } from "./LogEntryChoice";

export default async function NewWorkoutPage({
  searchParams,
}: {
  // Set by a feed workout post's "Log this WOD" link — see PostCard.
  searchParams: Promise<{ wodName?: string; description?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { wodName, description } = await searchParams;
  const prefillWod = wodName ? { wodName, description: description ?? "" } : null;

  const [gymWodWeek, user] = await Promise.all([
    // Nobody needs the gym-WODs-this-week suggestion once they've arrived
    // with a specific WOD already picked.
    prefillWod ? Promise.resolve(null) : getGymWodWeek(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: Object.fromEntries(PB_FIELDS.map((field) => [field, true])),
    }),
  ]);

  const initialPbs = Object.fromEntries(
    PB_FIELDS.map((field) => [field, (user as Record<string, number | null> | null)?.[field] ?? ""])
  ) as Record<PbField, number | "">;

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <div className="mt-4">
        <SectionCard title="Log">
          <LogEntryChoice gymWodWeek={gymWodWeek} prefillWod={prefillWod} initialPbs={initialPbs} />
        </SectionCard>
      </div>
    </main>
  );
}
