import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { Logo } from "@/components/Logo";

/**
 * A public, no-login landing page for one shared post — the link target
 * behind "Copy link"/WhatsApp/X/Facebook in ShareSheet (see
 * publicShareUrl). Unlike every other page in the app, this one has to
 * work for someone who isn't a Box 2 Box member at all, which is also why
 * it renders its own minimal page rather than reusing PostCard: no likes,
 * comments, or profile links, just enough to make the shared image and its
 * headline land properly when the link unfurls in WhatsApp/iMessage/X/etc,
 * plus a way in for someone who wants to see more.
 *
 * Visibility matches what any logged-in member could already see MINUS the
 * login requirement, with one exception: a post tied to a private event
 * (see assertEventVisible) is never served here, since there's no logged-
 * out equivalent of "is this viewer invited/participating" to check.
 */

async function loadPublicPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      contentText: true,
      photo: true,
      media: { orderBy: { order: "asc" }, take: 1, select: { url: true, kind: true } },
      createdAt: true,
      user: { select: { name: true, photo: true } },
      linkedEvent: { select: { isPrivate: true, status: true } },
      linkedEventResult: { select: { event: { select: { isPrivate: true, status: true } } } },
    },
  });
  if (!post) return null;

  const event = post.linkedEvent ?? post.linkedEventResult?.event ?? null;
  if (event && (event.isPrivate || event.status !== "APPROVED")) return null;

  return post;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const post = await loadPublicPost(postId);
  if (!post) return { title: "Box 2 Box" };

  const title = `${post.user.name} on Box 2 Box`;
  const description = post.contentText?.slice(0, 160) || "Shared from Box 2 Box.";
  const image = post.photo ?? post.media[0]?.url ?? null;
  const url = `${appUrl()}/s/post/${post.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
      siteName: "Box 2 Box",
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const post = await loadPublicPost(postId);
  if (!post) notFound();

  const image = post.photo ?? post.media[0]?.url ?? null;
  const isVideo = !post.photo && post.media[0]?.kind === "VIDEO";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center px-4 py-8 text-center">
      <Logo size="md" />

      <div className="mt-6 w-full overflow-hidden rounded-xl border border-b2b-purple/10 bg-b2b-card shadow-sm">
        {image &&
          (isVideo ? (
            <video src={image} controls playsInline className="aspect-[9/16] w-full bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- served straight from /media, no next/image domain config needed
            <img src={image} alt="" className="w-full object-cover" />
          ))}
        <div className="flex flex-col gap-1 p-4 text-left">
          <span className="text-sm font-semibold text-b2b-ink">{post.user.name}</span>
          {post.contentText && <p className="whitespace-pre-wrap text-sm text-b2b-ink/70">{post.contentText}</p>}
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
