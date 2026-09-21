import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { BottomTabBar } from "./BottomTabBar";

export async function NavBar() {
  const session = await getServerSession(authOptions);

  const [unreadMessages, unreadNotifications] = session?.user?.id
    ? await Promise.all([
        prisma.message.count({
          where: {
            conversation: { OR: [{ userOneId: session.user.id }, { userTwoId: session.user.id }] },
            senderId: { not: session.user.id },
            readAt: null,
          },
        }),
        prisma.notification.count({
          where: { userId: session.user.id, readAt: null },
        }),
      ])
    : [0, 0];

  return (
    <>
      <nav className="flex items-center justify-between gap-3 border-b border-b2b-purple/10 pb-4">
        <Logo size="sm" href="/feed" />
        <div className="flex items-center gap-4">
          <Link href="/notifications" className="relative text-b2b-ink/70 hover:text-b2b-pink" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
              <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
              <path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-b2b-pink text-[9px] font-semibold text-white">
                {unreadNotifications}
              </span>
            )}
          </Link>
          <SignOutButton />
        </div>
      </nav>
      <BottomTabBar unreadMessages={unreadMessages} />
    </>
  );
}
