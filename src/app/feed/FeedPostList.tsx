"use client";

import { useEffect, useState } from "react";
import { PostCard, type PostCardData } from "@/components/PostCard";

/** The API route returns dates as JSON strings — PostCard needs real Date objects (see formatEventDate/formatDateTime). */
function reviveDates(post: PostCardData): PostCardData {
  return {
    ...post,
    createdAt: new Date(post.createdAt),
    linkedEvent: post.linkedEvent
      ? {
          ...post.linkedEvent,
          date: new Date(post.linkedEvent.date),
          endDate: post.linkedEvent.endDate ? new Date(post.linkedEvent.endDate) : null,
        }
      : null,
  };
}

export function FeedPostList({
  initialPosts,
  initialCursor,
  initialHasMore,
  currentUserId,
  highlightPostId,
  highlightCommentId,
}: {
  initialPosts: PostCardData[];
  initialCursor: string | null;
  initialHasMore: boolean;
  currentUserId: string;
  highlightPostId?: string;
  highlightCommentId?: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  // router.refresh() (after posting or deleting) re-runs the server component
  // and hands down a fresh first page — without this, this component's own
  // state (set up once on mount) would never pick it up, so a just-created
  // post wouldn't show until a full manual reload.
  useEffect(() => {
    setPosts(initialPosts);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
  }, [initialPosts, initialCursor, initialHasMore]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    const res = await fetch(`/api/posts/feed?cursor=${cursor}`);
    setLoading(false);
    if (res.ok) {
      const body = await res.json();
      setPosts((prev) => [...prev, ...(body.posts as PostCardData[]).map(reviveDates)]);
      setCursor(body.nextCursor);
      setHasMore(body.hasMore);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          currentUserId={currentUserId}
          post={post}
          highlightPostId={highlightPostId}
          highlightCommentId={highlightCommentId}
        />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="self-center rounded-full border border-b2b-purple/15 bg-b2b-card px-5 py-2 text-sm font-medium text-b2b-ink hover:border-b2b-purple/30 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}
