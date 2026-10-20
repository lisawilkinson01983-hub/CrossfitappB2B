import { PB_LABELS } from "@/lib/labels";
import type { PbField } from "@/lib/validation";

export type NotificationView = {
  type: string;
  actor: { id: string; name: string };
  post: { id: string; type: string; photo: string | null; video: string | null; media: { kind: string }[] } | null;
  comment: { id: string } | null;
  event: { id: string; name: string } | null;
  gym: { id: string; name: string } | null;
  workoutId: string | null;
  pbField: string | null;
  emoji: string | null;
  storyId: string | null;
  eventWorkout: { eventId: string; number: number } | null;
  wallPost: { id: string; wallOwnerId: string } | null;
};

/** What a post actually is, for notification wording — a photo/video takes priority over its text type, since that's what the other person actually reacted to. */
function postContentLabel(post: NonNullable<NotificationView["post"]>): string {
  if (post.video || post.media.some((m) => m.kind === "VIDEO")) return "video";
  if (post.photo || post.media.some((m) => m.kind === "PHOTO")) return "photo";
  switch (post.type) {
    case "WORKOUT":
      return "workout";
    case "PR":
      return "PR";
    case "TEAMMATE_REQUEST":
      return "teammate request";
    default:
      return "post";
  }
}

/** The "{actor} ___" line for a notification — specific to what was actually acted on, not a generic "post"/"comment". */
export function notificationText(n: NotificationView): string {
  switch (n.type) {
    case "LIKE":
      return `liked your ${n.post ? postContentLabel(n.post) : "post"}`;
    case "COMMENT":
      return `commented on your ${n.post ? postContentLabel(n.post) : "post"}`;
    case "REPLY":
      return "replied to your comment";
    case "COMMENT_LIKE":
      return "liked your comment";
    case "COMMENT_REACTION":
      return n.emoji ? `reacted ${n.emoji} to your comment` : "reacted to your comment";
    case "POST_REACTION":
      return n.emoji
        ? `reacted ${n.emoji} to your ${n.post ? postContentLabel(n.post) : "post"}`
        : `reacted to your ${n.post ? postContentLabel(n.post) : "post"}`;
    case "EVENT_SUBMITTED":
      return `submitted "${n.event?.name ?? "an event"}" for review`;
    case "GYM_SUBMITTED":
      return `submitted "${n.gym?.name ?? "an affiliate"}" for review`;
    case "REPORT_SUBMITTED":
      return "reported something for review";
    case "AFFILIATE_VERIFICATION_REQUESTED":
      return "requested verification as an affiliate owner";
    case "EVENT_CLAIM_REQUESTED":
      return `requested to claim "${n.event?.name ?? "an event"}"`;
    case "TEAMMATE_REQUEST_MATCH":
      return `posted a teammate request matching your search for "${n.event?.name ?? "an event"}"`;
    case "TEAMMATE_SEARCH_MATCH":
      return `is looking for a team matching your request for "${n.event?.name ?? "an event"}"`;
    case "EVENT_INVITE":
      return `invited you to "${n.event?.name ?? "an event"}"`;
    case "FOLLOW":
      return "started following you";
    case "POST_SHARE":
      return `shared your ${n.post ? postContentLabel(n.post) : "post"}`;
    case "STATUS_REACTION":
      return n.emoji ? `reacted ${n.emoji} to your status` : "reacted to your status";
    case "WORKOUT_COMMENT":
      return "commented on your workout";
    case "WORKOUT_COMMENT_REACTION":
      return n.emoji ? `reacted ${n.emoji} to your workout comment` : "reacted to your workout comment";
    case "PB_COMMENT":
      return n.pbField && n.pbField in PB_LABELS
        ? `commented on your ${PB_LABELS[n.pbField as PbField]} PB`
        : "commented on your PB";
    case "PB_COMMENT_REACTION":
      return n.emoji ? `reacted ${n.emoji} to your PB comment` : "reacted to your PB comment";
    case "EVENT_PARTICIPANT_JOINED":
      return `is participating in "${n.event?.name ?? "your event"}"`;
    case "EVENT_NOTICE_REACTION":
      return n.emoji
        ? `reacted ${n.emoji} to your message board post for "${n.event?.name ?? "an event"}"`
        : `reacted to your message board post for "${n.event?.name ?? "an event"}"`;
    case "EVENT_NOTICE_COMMENT":
      return `commented on the message board for "${n.event?.name ?? "an event"}"`;
    case "EVENT_NOTICE_COMMENT_REACTION":
      return n.emoji
        ? `reacted ${n.emoji} to your message board comment`
        : "reacted to your message board comment";
    case "EVENT_WORKOUT_REACTION":
      return n.emoji ? `reacted ${n.emoji} to a workout you posted` : "reacted to a workout you posted";
    case "EVENT_TEAM_ADDED":
      return `added you to their team for "${n.event?.name ?? "an event"}" — you're marked as participating`;
    case "EVENT_TEAM_JOINED":
      return `joined your team for "${n.event?.name ?? "an event"}"`;
    case "NEW_USER_SIGNUP":
      return "just signed up for Box 2 Box";
    case "WORKOUT_PARTNER_TAGGED":
      return "tagged you as a workout partner";
    case "TEAM_INVITE":
      return `invited you to join their team for "${n.event?.name ?? "an event"}"`;
    case "TEAM_JOIN_REQUEST":
      return `wants to join your team for "${n.event?.name ?? "an event"}"`;
    case "TEAM_JOIN_APPROVED":
      return `approved your request to join their team for "${n.event?.name ?? "an event"}"`;
    case "TEAM_MEMBER_REMOVED":
      return `removed you from their team for "${n.event?.name ?? "an event"}"`;
    case "MENTION":
      return n.storyId ? "tagged you in their story" : "mentioned you";
    case "WALL_POST":
      return "posted on your wall";
    case "WALL_POST_COMMENT":
      return "commented on your wall post";
    default:
      return "mentioned you";
  }
}

/**
 * Where tapping a notification goes — always the specific thing it's about,
 * never just a generic listing. `viewerId` is the recipient (always the
 * current session, since these are always someone's own notifications) —
 * used for "your workout"/"your PB" links, which point at the viewer's own
 * gallery/PBs, not the actor's.
 */
export function notificationHref(n: NotificationView, viewerId: string): string {
  switch (n.type) {
    case "EVENT_SUBMITTED":
      return "/events/review";
    case "GYM_SUBMITTED":
      return "/gyms/review";
    case "REPORT_SUBMITTED":
      return "/reports/review";
    case "AFFILIATE_VERIFICATION_REQUESTED":
      return "/admin/verification-requests";
    case "EVENT_CLAIM_REQUESTED":
      return "/admin/event-claims";
    case "TEAMMATE_REQUEST_MATCH":
    case "TEAMMATE_SEARCH_MATCH":
    case "EVENT_INVITE":
    case "EVENT_PARTICIPANT_JOINED":
      return `/events/${n.event?.id ?? ""}`;
    case "EVENT_TEAM_ADDED":
    case "EVENT_TEAM_JOINED":
    case "TEAM_MEMBER_REMOVED":
      return `/events/${n.event?.id ?? ""}/teams`;
    // Unlike EVENT_TEAM_ADDED/EVENT_TEAM_JOINED (which just announce
    // something that already happened), these three need an action — accept/
    // decline an invite, approve/decline a request, or just see the result —
    // and that lives in My Teams, not the event's own Teams page.
    case "TEAM_INVITE":
    case "TEAM_JOIN_REQUEST":
    case "TEAM_JOIN_APPROVED":
      return "/events/mine?tab=teams";
    case "EVENT_NOTICE_COMMENT":
    case "EVENT_NOTICE_COMMENT_REACTION":
    case "EVENT_NOTICE_REACTION":
      return `/events/${n.event?.id ?? ""}/notices`;
    case "EVENT_WORKOUT_REACTION":
      return n.eventWorkout
        ? `/events/${n.eventWorkout.eventId}/workouts/${n.eventWorkout.number}`
        : "/feed";
    case "WORKOUT_COMMENT":
    case "WORKOUT_COMMENT_REACTION":
      return `/profile/${viewerId}/gallery${n.workoutId ? `?workout=${n.workoutId}` : ""}`;
    case "PB_COMMENT":
    case "PB_COMMENT_REACTION":
      return `/profile/${viewerId}/pbs${n.pbField ? `?field=${n.pbField}` : ""}`;
    case "STATUS_REACTION":
      return "/feed";
    case "FOLLOW":
    case "NEW_USER_SIGNUP":
      return `/profile/${n.actor.id}`;
    // Unlike WORKOUT_COMMENT (always on the viewer's own workout), the
    // workout here belongs to whoever tagged this user. If it was shared to
    // the feed, go straight to that post (n.post is set at notification-
    // creation time — see /api/workouts); only fall back to their gallery
    // for a workout that was never shared, since there'd be no post to go to.
    case "WORKOUT_PARTNER_TAGGED":
      if (n.post) return `/posts/${n.post.id}`;
      return `/profile/${n.actor.id}/gallery${n.workoutId ? `?workout=${n.workoutId}` : ""}`;
    case "WALL_POST":
    case "WALL_POST_COMMENT":
      return `/profile/${n.wallPost?.wallOwnerId ?? n.actor.id}?tab=wall`;
    case "MENTION":
      if (n.storyId) return `/feed?story=${n.storyId}`;
      if (n.event) return `/events/${n.event.id}/notices`;
      if (n.workoutId) return `/profile/${viewerId}/gallery?workout=${n.workoutId}`;
      if (n.pbField) return `/profile/${viewerId}/pbs?field=${n.pbField}`;
      return n.post ? `/posts/${n.post.id}${n.comment ? `?comment=${n.comment.id}` : ""}` : `/profile/${n.actor.id}`;
    default:
      return n.post ? `/posts/${n.post.id}${n.comment ? `?comment=${n.comment.id}` : ""}` : `/profile/${n.actor.id}`;
  }
}
