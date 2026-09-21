import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { WorkoutForm } from "../WorkoutForm";

export default async function NewWorkoutPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <div className="mt-6">
        <SectionCard title="Log a workout">
          <WorkoutForm />
        </SectionCard>
      </div>
    </main>
  );
}
