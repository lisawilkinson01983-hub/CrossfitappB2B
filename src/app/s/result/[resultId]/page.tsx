import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { Logo } from "@/components/Logo";
import { resultHeadline } from "@/lib/eventResults";

/**
 * Public, no-login twin of /s/post/[postId] for an EventResult shared
 * straight off the leaderboard — most results are never posted to the
 * feed (see loadEventResultCardData's own comment), so a result needs its
 * own link target rather than always routing through a Post. Same private-
 * event rule as the post page and /api/share/public/result/[resultId]/image.
 */

async function loadPublicResult(resultId: string) {
  const r = await prisma.eventResult.findUnique({
    where: { id: resultId },
    select: {
      id: true,
      place: true,
      placementType: true,
      totalCompetitors: true,
      user: { select: { name: true } },
      team: { select: { name: true } },
      event: { select: { name: true, isPrivate: true, status: true } },
    },
  });
  if (!r) return null;
  if (r.event.isPrivate || r.event.status !== "APPROVED") return null;
  return r;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resultId: string }>;
}): Promise<Metadata> {
  const { resultId } = await params;
  const r = await loadPublicResult(resultId);
  if (!r) return { title: "Box 2 Box" };

  const who = r.team ? `Team ${r.team.name}` : r.user.name;
  const title = `${who} — ${resultHeadline(r)} at ${r.event.name}`;
  const image = `${appUrl()}/api/share/public/result/${r.id}/image`;
  const url = `${appUrl()}/s/result/${r.id}`;

  return {
    title,
    description: `See the full result on Box 2 Box.`,
    openGraph: { title, url, images: [{ url: image }], siteName: "Box 2 Box" },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default async function PublicResultPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  const r = await loadPublicResult(resultId);
  if (!r) notFound();

  const who = r.team ? `Team ${r.team.name}` : r.user.name;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center px-4 py-8 text-center">
      <Logo size="md" />

      <div className="mt-6 w-full overflow-hidden rounded-xl border border-b2b-purple/10 bg-b2b-card shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered PNG, not a static asset next/image can optimize */}
        <img src={`/api/share/public/result/${r.id}/image`} alt="" className="w-full object-cover" />
        <div className="flex flex-col gap-1 p-4 text-left">
          <span className="text-sm font-semibold text-b2b-ink">{who}</span>
          <p className="text-sm text-b2b-ink/70">
            {resultHeadline(r)} at {r.event.name}
          </p>
        </div>
      </div>

      <Link
        href="/login"
        className="mt-6 w-full rounded-full bg-b2b-ink px-4 py-3 text-center text-sm font-semibold text-b2b-bg"
      >
        Open in Box 2 Box
      </Link>
      <p className="mt-3 text-xs text-b2b-ink/40">
        Box 2 Box is a community for CrossFit &amp; functional fitness athletes.
      </p>
    </main>
  );
}
