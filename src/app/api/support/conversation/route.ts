import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteAccountId } from "@/lib/siteAccount";
import { getOrCreateConversation } from "@/lib/conversations";

/** The bottom nav's "?" button — finds (or starts) the viewer's own DM thread with the Box 2 Box account, same as messaging any other person. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const siteAccountId = await getSiteAccountId();
  if (!siteAccountId) {
    return NextResponse.json({ error: "Messaging isn't set up yet — try again later." }, { status: 503 });
  }
  if (siteAccountId === session.user.id) {
    return NextResponse.json({ error: "You can't message yourself." }, { status: 400 });
  }

  const conversation = await getOrCreateConversation(session.user.id, siteAccountId);
  return NextResponse.json({ id: conversation.id });
}
