import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { NewEventForm } from "./NewEventForm";

export default async function NewEventPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Add an event</h1>
      <NewEventForm />
    </main>
  );
}
