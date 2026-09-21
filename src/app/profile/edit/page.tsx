import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLookingFor } from "@/lib/labels";
import { PB_FIELDS } from "@/lib/validation";
import { NavBar } from "@/components/NavBar";
import { EditProfileForm } from "./EditProfileForm";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Edit profile</h1>
      <EditProfileForm
        initial={{
          name: user.name,
          photo: user.photo,
          bio: user.bio ?? "",
          age: user.age ?? "",
          gender: user.gender ?? "",
          area: user.area ?? "",
          affiliateGym: user.affiliateGym ?? "",
          level: user.level ?? "",
          weightKg: user.weightKg ?? "",
          crossfitSinceYear: user.crossfitSinceYear ?? "",
          crossfitSinceMonth: user.crossfitSinceMonth ?? "",
          lookingFor: parseLookingFor(user.lookingFor),
          isSingle: user.isSingle,
          showSingleBadge: user.showSingleBadge,
          isPrivate: user.isPrivate,
          pbs: Object.fromEntries(PB_FIELDS.map((field) => [field, user[field] ?? ""])) as Record<
            (typeof PB_FIELDS)[number],
            number | ""
          >,
        }}
      />
    </main>
  );
}
