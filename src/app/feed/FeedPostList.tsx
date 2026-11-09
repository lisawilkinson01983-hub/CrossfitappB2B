"use client";

import { useEffect, useRef, useState } from "react";
import { PostCard, type PostCardData } from "@/components/PostCard";

// How often to check for posts newer than whatever's currently on screen —
// a "New posts" banner, not silently inserted, so reading mid-scroll never
// gets disrupted (see showNewPosts below). Lighter than ChatThread's 4s
// poll since this one re-fetches full postCardInclude payloads, not a
// single small conversation.
const NEW_POSTS_POLL_MS = 20000;

/** The API route returns dates as JSON strings — PostCard needs real Date objects (see formatEventDate/formatDateTime). */
function reviveDates(post: PostCardData): PostCardData {
  return {
    ...post,
    createdAt: new Date(post.createdAt),
    sharedBy: post.sharedBy ? { ...post.sharedBy, sharedAt: new Date(post.sharedBy.sharedAt) } : null,
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
  const [pendingNewPosts, setPendingNewPosts] = useState<PostCardData[]>([]);

  // router.refresh() (after posting or deleting) re-runs the server component
  // and hands down a fresh first page — without this, this component's own
  // state (set up once on mount) would never pick it up, so a just-created
  // post wouldn't show until a full manual reload.
  useEffect(() => {
    setPosts(initialPosts);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
    // A server-driven refresh already has the latest posts — any banner
    // offering to fetch "what's new" on top of the old state would be
    // showing stale (or now-duplicate) data.
    setPendingNewPosts([]);
  }, [initialPosts, initialCursor, initialHasMore]);

  // What the next poll checks "newer than" — a ref (not state) so the
  // interval below always reads the live value without needing to be torn
  // down and resubscribed every time `posts` changes. Falls back to the
  // epoch so an empty feed still polls for its very first post.
  const latestCreatedAtRef = useRef<string>(
    posts[0] ? new Date(posts[0].createdAt).toISOString() : new Date(0).toISOString()
  );
  useEffect(() => {
    latestCreatedAtRef.current = posts[0] ? new Date(posts[0].createdAt).toISOString() : new Date(0).toISOString();
  }, [posts]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/posts/feed/new?since=${encodeURIComponent(latestCreatedAtRef.current)}`);
      if (!res.ok) return;
      const body = await res.json();
      const newPosts = (body.posts as PostCardData[]).map(reviveDates);
      // Wholesale replace rather than merge — each tick re-asks "everything
      // newer than what's currently showing," so the response is already
      // the full, current answer.
      setPendingNewPosts(newPosts);
    }, NEW_POSTS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  function showNewPosts() {
    setPosts((prev) => [...pendingNewPosts, ...prev]);
    setPendingNewPosts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
      {pendingNewPosts.length > 0 && (
        <button
          type="button"
          onClick={showNewPosts}
          className="sticky top-2 z-10 self-center rounded-full bg-b2b-pink px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-b2b-pink-dark"
        >
          ↑ {pendingNewPosts.length} new {pendingNewPosts.length === 1 ? "post" : "posts"}
        </button>
      )}
      {posts.length === 0 ? (
        <p className="text-b2b-ink/50">No posts yet — be the first to share something, or share a workout from your log.</p>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.feedItemId}
            currentUserId={currentUserId}
            post={post}
            highlightPostId={highlightPostId}
            highlightCommentId={highlightCommentId}
          />
        ))
      )}
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
