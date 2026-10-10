import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { GymSubmitForm } from "@/components/GymSubmitForm";
import { DeleteGymButton } from "@/components/DeleteGymButton";
import { AFFILIATE_GYMS } from "@/lib/gyms";
import { BackLink } from "@/components/BackLink";

export default async function EditGymPage({ params }: { params: Promise<{ name: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const { name } = await params;
  const gym = await prisma.gym.findUnique({ where: { name: decodeURIComponent(name) } });
  if (!gym) notFound();

  const isFixedGym = (AFFILIATE_GYMS as readonly string[]).includes(gym.name);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/gyms/${encodeURIComponent(gym.name)}`} className="mt-6">Back to affiliate</BackLink>

      <div className="mt-4">
        <SectionCard title={`Edit "${gym.name}"`}>
          <GymSubmitForm
            mode="edit"
            gymId={gym.id}
            nameLocked={isFixedGym}
            initial={{
              name: gym.name,
              address: gym.address ?? "",
              websiteUrl: gym.website ?? "",
              description: gym.description ?? "",
              photo: gym.photo,
            }}
          />
        </SectionCard>
      </div>

      {!isFixedGym && (
        <div className="mt-4">
          <SectionCard title="Danger Zone">
            <DeleteGymButton gymId={gym.id} gymName={gym.name} />
          </SectionCard>
        </div>
      )}
    </main>
  );
}
