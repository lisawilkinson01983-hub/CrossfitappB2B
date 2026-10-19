"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  deletedUserCount: number;
  removed: {
    comments: number;
    eventNoticeComments: number;
    eventNotices: number;
    workoutComments: number;
    pbComments: number;
    postReactions: number;
    commentReactions: number;
    statusReactions: number;
    workoutCommentReactions: number;
    pbCommentReactions: number;
    eventNoticeReactions: number;
    eventNoticeCommentReactions: number;
    eventWorkoutReactions: number;
    messageReactions: number;
    workoutPartnerTags: number;
    teamMemberships: number;
    emptyTeams: number;
    stories: number;
    storyMentions: number;
    storyViews: number;
    savedPosts: number;
  };
};

export function CleanupDeletedButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleRun() {
    setError(null);
    setResult(null);
    setRunning(true);

    const res = await fetch("/api/admin/cleanup-deleted-content", { method: "POST" });
    setRunning(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const body = await res.json();
    setResult(body);
    router.refresh();
  }

  const total = result
    ? Object.values(result.removed).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="self-start rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {running ? "Cleaning up..." : "Run cleanup"}
      </button>
      {result && (
        <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3 text-sm text-b2b-ink/70">
          {total === 0 ? (
            <p>Nothing left to clean up — {result.deletedUserCount} deleted accounts, all already clear.</p>
          ) : (
            <>
              <p className="font-medium text-b2b-ink">Removed {total} items:</p>
              <ul className="mt-1 list-disc pl-5">
                {result.removed.comments > 0 && <li>{result.removed.comments} feed post comments</li>}
                {result.removed.eventNotices > 0 && <li>{result.removed.eventNotices} event message board posts</li>}
                {result.removed.eventNoticeComments > 0 && (
                  <li>{result.removed.eventNoticeComments} event message board comments</li>
                )}
                {result.removed.workoutComments > 0 && <li>{result.removed.workoutComments} workout comments</li>}
                {result.removed.pbComments > 0 && <li>{result.removed.pbComments} PB comments</li>}
                {result.removed.postReactions > 0 && <li>{result.removed.postReactions} feed post reactions</li>}
                {result.removed.commentReactions > 0 && <li>{result.removed.commentReactions} comment reactions</li>}
                {result.removed.statusReactions > 0 && <li>{result.removed.statusReactions} status reactions</li>}
                {result.removed.workoutCommentReactions > 0 && (
                  <li>{result.removed.workoutCommentReactions} workout comment reactions</li>
                )}
                {result.removed.pbCommentReactions > 0 && (
                  <li>{result.removed.pbCommentReactions} PB comment reactions</li>
                )}
                {result.removed.eventNoticeReactions > 0 && (
                  <li>{result.removed.eventNoticeReactions} event message board reactions</li>
                )}
                {result.removed.eventNoticeCommentReactions > 0 && (
                  <li>{result.removed.eventNoticeCommentReactions} event message board comment reactions</li>
                )}
                {result.removed.eventWorkoutReactions > 0 && (
                  <li>{result.removed.eventWorkoutReactions} event workout reactions</li>
                )}
                {result.removed.messageReactions > 0 && <li>{result.removed.messageReactions} message reactions</li>}
                {result.removed.workoutPartnerTags > 0 && (
                  <li>{result.removed.workoutPartnerTags} workout partner tags</li>
                )}
                {result.removed.teamMemberships > 0 && (
                  <li>{result.removed.teamMemberships} event team memberships</li>
                )}
                {result.removed.emptyTeams > 0 && <li>{result.removed.emptyTeams} now-empty event teams</li>}
                {result.removed.stories > 0 && <li>{result.removed.stories} still-active stories</li>}
                {result.removed.storyMentions > 0 && <li>{result.removed.storyMentions} story tags</li>}
                {result.removed.storyViews > 0 && <li>{result.removed.storyViews} story views</li>}
                {result.removed.savedPosts > 0 && <li>{result.removed.savedPosts} saved posts</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
