import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { BackLink } from "@/components/BackLink";
import { SectionCard } from "@/components/SectionCard";
import { getGymWodSuggestion } from "@/lib/gymSuggestion";
import { PB_FIELDS, type PbField } from "@/lib/validation";
import { LogEntryChoice } from "./LogEntryChoice";

export default async function NewWorkoutPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [gymSuggestion, user] = await Promise.all([
    getGymWodSuggestion(session.user.id),
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
      <BackLink href="/workouts" className="mt-6">Back to workouts</BackLink>
      <div className="mt-4">
        <SectionCard title="Log">
          <LogEntryChoice gymSuggestion={gymSuggestion} initialPbs={initialPbs} />
        </SectionCard>
      </div>
    </main>
  );
}
