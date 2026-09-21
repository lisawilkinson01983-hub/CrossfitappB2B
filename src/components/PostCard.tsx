"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LEVEL_LABELS, WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";
import type { LevelOption, WorkoutIntensityOption, WorkoutUnitOption } from "@/lib/validation";

export type PostCardData = {
  id: string;
  type: "WORKOUT" | "PR" | "UPDATE";
  contentText: string | null;
  photo: string | null;
  createdAt: Date;
  isOwner: boolean;
  author: {
    id: string;
    name: string;
    photo: string | null;
    level: LevelOption | null;
  };
  linkedWorkout: {
    wodName: string;
    score: string;
    unit: WorkoutUnitOption;
    intensity: WorkoutIntensityOption;
  } | null;
  likeCount: number;
  likedByMe: boolean;
  comments: {
    id: string;
    text: string;
    createdAt: Date;
    author: { id: string; name: string };
  }[];
};

export function PostCard({ post }: { post: PostCardData }) {
  const router = useRouter();
  const isPb = post.type === "PR";

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const [deleting, setDeleting] = useState(false);

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    setLikeBusy(false);
    if (res.ok) {
      const body = await res.json();
      setLiked(body.liked);
      setLikeCount(body.count);
    }
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText }),
    });
    setCommentBusy(false);
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, body.comment]);
      setCommentText("");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this post?")) return;
    setDeleting(true);
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.refresh();
  }

  return (
    <div
      className={`rounded border p-4 ${
        isPb ? "border-yellow-400 bg-yellow-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <Link href={`/profile/${post.author.id}`} className="flex items-center gap-3">
          {post.author.photo ? (
            <Image
              src={post.author.photo}
              alt={post.author.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500">
              {post.author.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold hover:underline">{post.author.name}</span>
              {post.author.level && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {LEVEL_LABELS[post.author.level]}
                </span>
              )}
              {isPb && <span className="text-sm font-semibold text-yellow-600">★ PB</span>}
            </div>
            <p className="text-xs text-gray-400">{post.createdAt.toLocaleString()}</p>
          </div>
        </Link>
        {post.isOwner && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>

      {post.linkedWorkout && (
        <p className="mt-3 text-sm text-gray-600">
          {post.linkedWorkout.wodName} · {post.linkedWorkout.score} (
          {WORKOUT_UNIT_LABELS[post.linkedWorkout.unit]}) ·{" "}
          {WORKOUT_INTENSITY_LABELS[post.linkedWorkout.intensity]}
        </p>
      )}

      {post.contentText && <p className="mt-2 whitespace-pre-wrap text-gray-900">{post.contentText}</p>}

      {post.photo && (
        <Image
          src={post.photo}
          alt="Post photo"
          width={500}
          height={500}
          className="mt-3 max-h-96 w-full rounded object-cover"
        />
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          disabled={likeBusy}
          className={`font-medium ${liked ? "text-pink-600" : "text-gray-600"} hover:underline disabled:opacity-50`}
        >
          {liked ? "♥ Liked" : "♡ Like"} {likeCount > 0 && `(${likeCount})`}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="font-medium text-gray-600 hover:underline"
        >
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
          {comments.map((comment) => (
            <p key={comment.id} className="text-sm">
              <span className="font-semibold">{comment.author.name}</span>{" "}
              <span className="text-gray-800">{comment.text}</span>
            </p>
          ))}
          <form onSubmit={submitComment} className="mt-1 flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={commentBusy || !commentText.trim()}
              className="rounded bg-gray-800 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              Reply
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
