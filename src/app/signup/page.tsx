import Link from "next/link";
import { SignupForm } from "./SignupForm";
import { isInviteOnly } from "@/lib/inviteCode";

// Reads INVITE_ONLY at request time, so flipping it in Railway takes effect
// without a rebuild.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold">Sign up</h1>
      <SignupForm inviteOnly={isInviteOnly()} />
      <p className="mt-4 text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-b2b-pink underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
