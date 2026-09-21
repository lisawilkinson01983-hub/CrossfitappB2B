import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "./SignOutButton";

export async function NavBar() {
  const session = await getServerSession(authOptions);

  const unreadCount = session?.user?.id
    ? await prisma.message.count({
        where: {
          conversation: { OR: [{ userOneId: session.user.id }, { userTwoId: session.user.id }] },
          senderId: { not: session.user.id },
          readAt: null,
        },
      })
    : 0;

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 pb-4">
      <div className="flex gap-4 text-sm font-medium">
        <Link href="/feed" className="text-gray-700 hover:text-blue-600">
          Feed
        </Link>
        <Link href="/discover" className="text-gray-700 hover:text-blue-600">
          Discover
        </Link>
        <Link href="/messages" className="flex items-center gap-1 text-gray-700 hover:text-blue-600">
          Messages
          {unreadCount > 0 && (
            <span className="rounded-full bg-pink-600 px-1.5 py-0.5 text-xs font-medium text-white">
              {unreadCount}
            </span>
          )}
        </Link>
        <Link href="/profile" className="text-gray-700 hover:text-blue-600">
          Profile
        </Link>
        <Link href="/workouts" className="text-gray-700 hover:text-blue-600">
          Workouts
        </Link>
      </div>
      <SignOutButton />
    </nav>
  );
}
