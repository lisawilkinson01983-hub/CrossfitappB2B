import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findVerifiedGymOwner } from "@/lib/gymPages";
import { getOrCreateConversation } from "@/lib/conversations";
import { gymBookingEmailSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";

const BOOKING_LABELS = {
  intro: "an Intro Session",
  dropin: "a Drop-in",
} as const;
type BookingType = keyof typeof BOOKING_LABELS;

function isBookingType(value: unknown): value is BookingType {
  return value === "intro" || value === "dropin";
}

/**
 * An athlete tapping "Book an Intro Session"/"Book a Drop-in" on a gym's
 * page, for a gym that hasn't set a bookingEmail — sends it as an opening
 * in-app message to the gym's verified affiliate account instead.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const gym = await prisma.gym.findUnique({ where: { id } });
  if (!gym) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (gym.bookingEmail) {
    return NextResponse.json({ error: "This affiliate takes bookings by email" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const type = body?.type;
  if (!isBookingType(type)) {
    return NextResponse.json({ error: "Invalid booking type" }, { status: 400 });
  }

  const owner = await findVerifiedGymOwner(gym.name);
  if (!owner) {
    return NextResponse.json({ error: "This affiliate hasn't set up bookings yet" }, { status: 404 });
  }
  if (owner.id === session.user.id) {
    return NextResponse.json({ error: "You can't book at your own gym" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(session.user.id, "gym-booking", { limit: 10, windowMs: 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many booking requests. Please slow down." }, { status: 429 });
  }

  const conversation = await getOrCreateConversation(session.user.id, owner.id);
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: session.user.id,
      text: `Hi! I'd like to book ${BOOKING_LABELS[type]} at ${gym.name}.`,
    },
  });

  return NextResponse.json({ conversationId: conversation.id });
}

/**
 * The gym's own verified affiliate account setting (or clearing) where
 * bookings should be emailed instead of arriving as in-app messages.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const gym = await prisma.gym.findUnique({ where: { id } });
  if (!gym) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, affiliateGym: true, verifiedAt: true },
  });
  if (me?.accountType !== "AFFILIATE" || me.affiliateGym !== gym.name || !me.verifiedAt) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = gymBookingEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await prisma.gym.update({ where: { id }, data: { bookingEmail: parsed.data.bookingEmail ?? null } });

  return NextResponse.json({ ok: true });
}
