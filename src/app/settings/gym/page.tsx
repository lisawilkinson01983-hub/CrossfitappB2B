import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { GymBookingForm } from "@/components/GymBookingForm";
import { UNAFFILIATED, OTHER_GYM } from "@/lib/gyms";

export default async function GymBookingSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, affiliateGym: true, verifiedAt: true },
  });
  if (!me || me.accountType !== "AFFILIATE") notFound();

  const hasRealGym = me.affiliateGym != null && me.affiliateGym !== UNAFFILIATED && me.affiliateGym !== OTHER_GYM;
  const gym = hasRealGym ? await prisma.gym.findUnique({ where: { name: me.affiliateGym! } }) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to settings
      </Link>

      <div className="mt-4">
        <SectionCard title="Bookings">
          {!gym ? (
            <p className="text-b2b-ink/70">
              Set your gym in{" "}
              <Link href="/profile/edit" className="text-b2b-pink underline">
                your profile
              </Link>{" "}
              first, then come back here to set up bookings.
            </p>
          ) : !me.verifiedAt ? (
            <p className="text-b2b-ink/70">
              You need to be a verified affiliate before you can set up bookings for {gym.name} — this stops anyone
              else from redirecting your gym&apos;s booking requests. Request verification from{" "}
              <Link href="/profile/edit" className="text-b2b-pink underline">
                your profile
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="text-b2b-ink/70">
                Choose where "Book an Intro Session" and "Book a Drop-in" taps on {gym.name}&apos;s page go.
              </p>
              <div className="mt-4">
                <GymBookingForm gymId={gym.id} initialEmail={gym.bookingEmail ?? ""} />
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
