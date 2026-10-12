import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-bold text-b2b-page-ink">Forgot your password?</h1>
      <p className="mb-6 text-sm text-b2b-page-ink/70">
        Enter your email and we'll send you a link to reset it.
      </p>
      <ForgotPasswordForm />
      <p className="mt-4 text-sm text-b2b-page-ink/70">
        <Link href="/login" className="text-b2b-pink underline">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
