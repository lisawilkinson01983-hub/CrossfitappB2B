import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const result = await verify(token);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      <div className="mx-auto">
        <Logo size="sm" />
      </div>
      <h1 className="mt-6 text-xl font-bold">{result.title}</h1>
      <p className="mt-2 text-sm text-b2b-ink/60">{result.message}</p>
      <Link href="/feed" className="mt-6 rounded bg-b2b-pink px-4 py-2 font-medium text-white hover:bg-b2b-pink-dark">
        Continue to Box 2 Box
      </Link>
    </main>
  );
}

async function verify(token: string | undefined): Promise<{ title: string; message: string }> {
  if (!token) {
    return { title: "Missing link", message: "This verification link is missing its token." };
  }

  const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });
  if (!user) {
    return {
      title: "Link no longer valid",
      message: "This verification link has already been used, or doesn't match any account.",
    };
  }

  if (user.emailVerificationTokenExpiresAt && user.emailVerificationTokenExpiresAt < new Date()) {
    return {
      title: "Link expired",
      message: "This verification link has expired. You can request a new one from Settings.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerificationToken: null, emailVerificationTokenExpiresAt: null },
  });

  return { title: "Email verified", message: "Thanks — your email address is confirmed." };
}
