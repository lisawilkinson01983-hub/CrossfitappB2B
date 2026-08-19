import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome, {session.user.name}</h1>
        <SignOutButton />
      </div>
      <p className="mt-4">
        <Link href="/profile" className="text-blue-600 underline">
          View your profile
        </Link>
      </p>
    </main>
  );
}
