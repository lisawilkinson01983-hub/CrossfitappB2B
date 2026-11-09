import { prisma } from "@/lib/prisma";

/**
 * Removes every piece of content a set of now-deleted (User.deletedAt set)
 * profiles left behind — including a stray reaction, workout-partner tag, or
 * team-roster entry sitting on content that still belongs to someone else
 * who's still active, not just content the deleted profile fully owned.
 * Shared by the live account-deletion route (called right after anonymizing)
 * and the admin retroactive-cleanup route (called across every already-
 * deleted profile, to catch anything added to the list after they left).
 *
 * Deliberately left alone, matching /api/account/delete's own policy:
 * Message/Conversation history (so a deleted participant's messages don't
 * vanish out from under the rest of a conversation), Report rows (an admin
 * audit trail), and anything the profile created/submitted that still has a
 * life of its own for other people — an Event, a Gym, an EventWorkout entry,
 * a Team they created (never shown as "created by" anywhere in the UI).
 *
 * Safe to call more than once — each pass only finds what the last one left
 * behind (every query here is a plain `deleteMany`/`findMany`, never an
 * upsert or anything that would recreate what was already removed).
 */
export async function removeDeletedUserContent(userIds: string[]) {
  if (userIds.length === 0) {
    return {
      comments: 0,
      eventNoticeComments: 0,
      eventNotices: 0,
      workoutComments: 0,
      pbComments: 0,
      postReactions: 0,
      commentReactions: 0,
      statusReactions: 0,
      workoutCommentReactions: 0,
      pbCommentReactions: 0,
      eventNoticeReactions: 0,
      eventNoticeCommentReactions: 0,
      eventWorkoutReactions: 0,
      messageReactions: 0,
      workoutPartnerTags: 0,
      teamMemberships: 0,
      emptyTeams: 0,
      stories: 0,
      storyMentions: 0,
      storyViews: 0,
      savedPosts: 0,
    };
  }

  return prisma.$transaction(async (tx) => {
    const [
      comments,
      eventNoticeComments,
      eventNotices,
      workoutComments,
      pbComments,
      postReactions,
      commentReactions,
      statusReactions,
      workoutCommentReactions,
      pbCommentReactions,
      eventNoticeReactions,
      eventNoticeCommentReactions,
      eventWorkoutReactions,
      messageReactions,
      workoutPartnerTags,
      savedPosts,
      storyMentions,
      storyViews,
      stories,
    ] = await Promise.all([
      tx.comment.deleteMany({ where: { userId: { in: userIds } } }),
      tx.eventNoticeComment.deleteMany({ where: { userId: { in: userIds } } }),
      tx.eventNotice.deleteMany({ where: { userId: { in: userIds } } }),
      tx.workoutComment.deleteMany({ where: { userId: { in: userIds } } }),
      tx.pbComment.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { profileUserId: { in: userIds } }] } }),

      // Reactions a deleted profile left on anyone's post/comment/notice/
      // message/status/workout — none of these were previously cleaned up
      // at all, so a deleted user's emoji could keep inflating a reaction
      // count (or show their name in the "who reacted" list) on someone
      // else's still-active content indefinitely.
      tx.postReaction.deleteMany({ where: { userId: { in: userIds } } }),
      tx.commentReaction.deleteMany({ where: { userId: { in: userIds } } }),
      tx.statusReaction.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { reactorId: { in: userIds } }] } }),
      tx.workoutCommentReaction.deleteMany({ where: { userId: { in: userIds } } }),
      tx.pbCommentReaction.deleteMany({ where: { userId: { in: userIds } } }),
      tx.eventNoticeReaction.deleteMany({ where: { userId: { in: userIds } } }),
      tx.eventNoticeCommentReaction.deleteMany({ where: { userId: { in: userIds } } }),
      tx.eventWorkoutReaction.deleteMany({ where: { userId: { in: userIds } } }),
      tx.messageReaction.deleteMany({ where: { userId: { in: userIds } } }),

      // Tagged as a workout partner on someone else's still-logged workout —
      // same "stray tag on someone else's content" gap as the reactions
      // above.
      tx.workoutPartner.deleteMany({ where: { userId: { in: userIds } } }),

      // Purely personal, invisible to anyone but the deleted profile itself
      // — cleaned up for hygiene, same as Like/CommentLike already were.
      tx.savedPost.deleteMany({ where: { userId: { in: userIds } } }),

      // Tagged in, or having viewed, someone else's still-active story.
      tx.storyMention.deleteMany({ where: { userId: { in: userIds } } }),
      tx.storyView.deleteMany({ where: { viewerId: { in: userIds } } }),

      // A still-active (not yet expired) story of the deleted profile's own
      // — nothing left to show once the profile behind it is anonymized,
      // so it comes down now rather than lingering with a "Deleted User"
      // byline until it naturally expires.
      tx.story.deleteMany({ where: { userId: { in: userIds } } }),
    ]);

    // Team rosters: only the deleted profile's OWN membership row comes
    // out — same treatment as EventParticipant/EventInterest/EventPin
    // above, since this is their own participation record, not something
    // that belongs to whoever else is on the team.
    const affectedTeams = await tx.teamMember.findMany({
      where: { userId: { in: userIds } },
      select: { teamId: true },
      distinct: ["teamId"],
    });
    const teamMemberships = await tx.teamMember.deleteMany({ where: { userId: { in: userIds } } });

    // A team left with no real members at all once the deleted profile's
    // row comes out is an empty husk — nothing left to show on the event's
    // Teams page or the "already on one of these teams" join prompt.
    let emptyTeams = 0;
    if (affectedTeams.length > 0) {
      const remaining = await tx.teamMember.groupBy({
        by: ["teamId"],
        where: { teamId: { in: affectedTeams.map((t) => t.teamId) } },
        _count: true,
      });
      const stillHasMembers = new Set(remaining.map((r) => r.teamId));
      const emptyTeamIds = affectedTeams.map((t) => t.teamId).filter((id) => !stillHasMembers.has(id));
      if (emptyTeamIds.length > 0) {
        emptyTeams = (await tx.team.deleteMany({ where: { id: { in: emptyTeamIds } } })).count;
      }
    }

    return {
      comments: comments.count,
      eventNoticeComments: eventNoticeComments.count,
      eventNotices: eventNotices.count,
      workoutComments: workoutComments.count,
      pbComments: pbComments.count,
      postReactions: postReactions.count,
      commentReactions: commentReactions.count,
      statusReactions: statusReactions.count,
      workoutCommentReactions: workoutCommentReactions.count,
      pbCommentReactions: pbCommentReactions.count,
      eventNoticeReactions: eventNoticeReactions.count,
      eventNoticeCommentReactions: eventNoticeCommentReactions.count,
      eventWorkoutReactions: eventWorkoutReactions.count,
      messageReactions: messageReactions.count,
      workoutPartnerTags: workoutPartnerTags.count,
      teamMemberships: teamMemberships.count,
      emptyTeams,
      stories: stories.count,
      storyMentions: storyMentions.count,
      storyViews: storyViews.count,
      savedPosts: savedPosts.count,
    };
  });
}
