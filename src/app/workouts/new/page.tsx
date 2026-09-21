import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { WorkoutForm } from "../WorkoutForm";

export default async function NewWorkoutPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Log a workout</h1>
      <WorkoutForm />
    </main>
  );
}
