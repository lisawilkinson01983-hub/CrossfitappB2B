import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <LoginForm />
      <p className="mt-4 text-sm text-gray-600">
        <Link href="/forgot-password" className="text-b2b-pink underline">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-gray-600">
        No account?{" "}
        <Link href="/signup" className="text-b2b-pink underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
