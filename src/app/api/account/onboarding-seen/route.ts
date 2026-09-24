import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Each key names one of the standalone onboarding popups (see
// SectionOnboarding) and the User column it marks as seen.
const SECTION_FIELDS = {
  welcome: "hasSeenOnboarding",
  feed: "hasSeenFeedTour",
  discover: "hasSeenDiscoverTour",
  events: "hasSeenEventsTour",
  workouts: "hasSeenWorkoutsTour",
} as const;

type Section = keyof typeof SECTION_FIELDS;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const section = body?.section;
  if (typeof section !== "string" || !(section in SECTION_FIELDS)) {
    return NextResponse.json({ error: "Not a valid section" }, { status: 400 });
  }

  switch (section as Section) {
    case "welcome":
      await prisma.user.update({ where: { id: session.user.id }, data: { hasSeenOnboarding: true } });
      break;
    case "feed":
      await prisma.user.update({ where: { id: session.user.id }, data: { hasSeenFeedTour: true } });
      break;
    case "discover":
      await prisma.user.update({ where: { id: session.user.id }, data: { hasSeenDiscoverTour: true } });
      break;
    case "events":
      await prisma.user.update({ where: { id: session.user.id }, data: { hasSeenEventsTour: true } });
      break;
    case "workouts":
      await prisma.user.update({ where: { id: session.user.id }, data: { hasSeenWorkoutsTour: true } });
      break;
  }

  return NextResponse.json({ ok: true });
}
