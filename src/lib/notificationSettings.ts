import type { NotificationType } from "@prisma/client";

/**
 * Every notification someone can switch off, as listed on Settings →
 * Notifications. Each row covers one or more NotificationTypes and has two
 * switches: Push (a phone alert from the store app) and In app (the bell
 * list and its red dot). Everything is on unless the profile turns it off.
 *
 * When a new NotificationType is added, add it to a row here too (a type
 * that isn't listed can't be switched off, but is still always delivered).
 */

export type NotificationSetting = {
  key: string;
  label: string;
  description: string;
  types: NotificationType[];
  /** Only shown to admins / affiliate profiles. */
  audience?: "admin" | "affiliate";
  /** No in-app switch (messages have their own tab; announcements always show). */
  pushOnly?: boolean;
  inAppLocked?: boolean;
};

export type NotificationSection = { title: string; settings: NotificationSetting[] };

/** The one row that isn't a Notification — direct and group chat messages. */
export const MESSAGES_KEY = "messages";

export const NOTIFICATION_SECTIONS: NotificationSection[] = [
  {
    title: "Messages",
    settings: [
      {
        key: MESSAGES_KEY,
        label: "Messages",
        description: "New direct and group chat messages",
        types: [],
        pushOnly: true,
      },
    ],
  },
  {
    title: "Your posts",
    settings: [
      { key: "likes", label: "Likes", description: "Someone likes your post", types: ["LIKE"] },
      { key: "post_reactions", label: "Reactions", description: "Someone reacts to your post with an emoji", types: ["POST_REACTION"] },
      { key: "comments", label: "Comments", description: "Someone comments on your post", types: ["COMMENT"] },
      { key: "replies", label: "Replies", description: "Someone replies to your comment", types: ["REPLY"] },
      {
        key: "comment_threads",
        label: "Conversations you're in",
        description: "Someone else comments on a post you've commented on",
        types: ["COMMENT_THREAD"],
      },
      {
        key: "comment_likes",
        label: "Likes and reactions on your comments",
        description: "Someone likes or reacts to a comment you wrote",
        types: ["COMMENT_LIKE", "COMMENT_REACTION"],
      },
      { key: "shares", label: "Shares", description: "Someone shares your post to their feed", types: ["POST_SHARE"] },
      { key: "mentions", label: "Mentions and tags", description: "Someone mentions you or tags you in their story", types: ["MENTION"] },
    ],
  },
  {
    title: "Your profile",
    settings: [
      { key: "follows", label: "New followers", description: "Someone starts following you", types: ["FOLLOW"] },
      {
        key: "follow_requests",
        label: "Follow requests",
        description: "Someone asks to follow your private profile, or accepts your request",
        types: ["FOLLOW_REQUEST", "FOLLOW_REQUEST_ACCEPTED"],
      },
      { key: "status", label: "Status reactions", description: "Someone reacts to your status", types: ["STATUS_REACTION"] },
      { key: "wall_posts", label: "Wall posts", description: "Someone posts on your wall or shares a wall post of yours", types: ["WALL_POST", "WALL_POST_SHARE"] },
      {
        key: "wall_activity",
        label: "Wall comments and reactions",
        description: "Someone comments on or reacts to a wall post",
        types: ["WALL_POST_COMMENT", "WALL_POST_COMMENT_REACTION", "WALL_POST_REACTION"],
      },
    ],
  },
  {
    title: "Workouts and PBs",
    settings: [
      {
        key: "workout_comments",
        label: "Workout comments",
        description: "Someone comments on your workout, or reacts to your comment on one",
        types: ["WORKOUT_COMMENT", "WORKOUT_COMMENT_REACTION"],
      },
      {
        key: "pb_comments",
        label: "PB comments",
        description: "Someone comments on your PB, or reacts to your comment on one",
        types: ["PB_COMMENT", "PB_COMMENT_REACTION"],
      },
      { key: "workout_partners", label: "Workout partner tags", description: "Someone tags you as a workout partner", types: ["WORKOUT_PARTNER_TAGGED"] },
      { key: "result_tags", label: "Result tags", description: "Someone tags you in an event result", types: ["RESULT_TAG_REQUEST"] },
    ],
  },
  {
    title: "Events",
    settings: [
      { key: "event_invites", label: "Event invites", description: "You're invited to a private event", types: ["EVENT_INVITE"] },
      { key: "event_reminders", label: "Event reminders", description: "An event you're in starts within 24 hours", types: ["EVENT_REMINDER"] },
      { key: "event_updates", label: "Event changes", description: "The date or venue changes for an event you're in or interested in", types: ["EVENT_UPDATED"] },
      {
        key: "event_participants",
        label: "New participants",
        description: "Someone joins a private event you organise",
        types: ["EVENT_PARTICIPANT_JOINED"],
      },
      {
        key: "event_boards",
        label: "Event message boards",
        description: "Comments and reactions on event message boards and workouts you've posted",
        types: ["EVENT_NOTICE_COMMENT", "EVENT_NOTICE_REACTION", "EVENT_NOTICE_COMMENT_REACTION", "EVENT_WORKOUT_REACTION"],
      },
      {
        key: "submissions",
        label: "Your submissions",
        description: "An event, affiliate or event claim you submitted is approved or declined",
        types: ["EVENT_APPROVED", "EVENT_REJECTED", "GYM_APPROVED", "GYM_REJECTED", "EVENT_CLAIM_APPROVED", "EVENT_CLAIM_DISMISSED"],
      },
    ],
  },
  {
    title: "Teams",
    settings: [
      {
        key: "teammate_matches",
        label: "Teammate matches",
        description: "Someone's teammate request or team search matches yours",
        types: ["TEAMMATE_REQUEST_MATCH", "TEAMMATE_SEARCH_MATCH"],
      },
      {
        key: "team_invites",
        label: "Team invites and requests",
        description: "You're invited to a team, someone asks to join yours, or your request is approved",
        types: ["TEAM_INVITE", "TEAM_JOIN_REQUEST", "TEAM_JOIN_APPROVED"],
      },
      {
        key: "team_changes",
        label: "Team changes",
        description: "You're added to or removed from a team, or someone joins yours",
        types: ["EVENT_TEAM_ADDED", "EVENT_TEAM_JOINED", "TEAM_MEMBER_REMOVED"],
      },
    ],
  },
  {
    title: "Box 2 Box",
    settings: [
      {
        key: "announcements",
        label: "Announcements",
        description: "News and notices from the Box 2 Box team — these always appear in the app",
        types: ["SYSTEM_ANNOUNCEMENT"],
        inAppLocked: true,
      },
      { key: "report_updates", label: "Report updates", description: "Action is taken on something you reported", types: ["REPORT_ACTIONED"] },
      {
        key: "verification",
        label: "Affiliate verification",
        description: "Your affiliate account is verified, or couldn't be",
        types: ["VERIFICATION_APPROVED", "VERIFICATION_DISMISSED"],
        audience: "affiliate",
      },
    ],
  },
  {
    title: "Admin",
    settings: [
      {
        key: "admin_reviews",
        label: "Things to review",
        description: "New event, affiliate and claim submissions, and verification requests",
        types: ["EVENT_SUBMITTED", "GYM_SUBMITTED", "EVENT_CLAIM_REQUESTED", "AFFILIATE_VERIFICATION_REQUESTED"],
        audience: "admin",
      },
      { key: "admin_reports", label: "New reports", description: "Someone reports a user or content", types: ["REPORT_SUBMITTED"], audience: "admin" },
      { key: "admin_signups", label: "New sign-ups", description: "Someone joins Box 2 Box", types: ["NEW_USER_SIGNUP"], audience: "admin" },
    ],
  },
];

const ALL_SETTINGS = NOTIFICATION_SECTIONS.flatMap((s) => s.settings);
const SETTING_BY_KEY = new Map(ALL_SETTINGS.map((s) => [s.key, s]));
const KEY_BY_TYPE = new Map<NotificationType, string>(ALL_SETTINGS.flatMap((s) => s.types.map((t) => [t, s.key] as const)));

export function getNotificationSetting(key: string): NotificationSetting | undefined {
  return SETTING_BY_KEY.get(key);
}

export type Channel = "push" | "inApp";
export type NotificationPrefs = Record<string, { push?: boolean; inApp?: boolean }>;

export function parseNotificationPrefs(raw: string | null | undefined): NotificationPrefs {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Is this setting on for this channel? Everything defaults to on. */
export function isEnabled(prefs: NotificationPrefs, key: string, channel: Channel): boolean {
  const setting = SETTING_BY_KEY.get(key);
  if (channel === "inApp" && (setting?.inAppLocked || setting?.pushOnly)) return true;
  return prefs[key]?.[channel] !== false;
}

/** Should a notification of this type go out on this channel? Types not in the list are always sent. */
export function typeEnabled(prefs: NotificationPrefs, type: NotificationType, channel: Channel): boolean {
  const key = KEY_BY_TYPE.get(type);
  return key ? isEnabled(prefs, key, channel) : true;
}

/** The types this profile has hidden from the bell — for `type: { notIn: ... }` filters. */
export function hiddenInAppTypes(prefs: NotificationPrefs): NotificationType[] {
  return ALL_SETTINGS.filter((s) => !isEnabled(prefs, s.key, "inApp")).flatMap((s) => s.types);
}
