import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold">Set a new password</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          This link is missing its token. Request a new one from the forgot-password page.
        </p>
      )}
    </main>
  );
}
