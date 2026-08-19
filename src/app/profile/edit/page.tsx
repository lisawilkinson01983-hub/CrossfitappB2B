import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLookingFor } from "@/lib/labels";
import { EditProfileForm } from "./EditProfileForm";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Edit profile</h1>
      <EditProfileForm
        initial={{
          name: user.name,
          photo: user.photo,
          bio: user.bio ?? "",
          age: user.age ?? "",
          area: user.area ?? "",
          affiliateGym: user.affiliateGym ?? "",
          level: user.level ?? "",
          weightKg: user.weightKg ?? "",
          crossfitSinceYear: user.crossfitSinceYear ?? "",
          crossfitSinceMonth: user.crossfitSinceMonth ?? "",
          lookingFor: parseLookingFor(user.lookingFor),
        }}
      />
    </main>
  );
}
