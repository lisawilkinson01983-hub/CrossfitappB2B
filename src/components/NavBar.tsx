import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

export function NavBar() {
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 pb-4">
      <div className="flex gap-4 text-sm font-medium">
        <Link href="/feed" className="text-gray-700 hover:text-blue-600">
          Feed
        </Link>
        <Link href="/discover" className="text-gray-700 hover:text-blue-600">
          Discover
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
