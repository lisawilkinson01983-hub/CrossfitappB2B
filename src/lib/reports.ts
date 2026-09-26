import { prisma } from "@/lib/prisma";
import type { ReportTargetTypeOption } from "@/lib/validation";

export type ReportTarget = {
  ownerId: string;
  contentSnapshot: string | null;
  mediaSnapshot: string | null;
  // Where an admin can see the content in context, if anywhere.
  href: string | null;
};

/**
 * Looks up the thing being reported and who owns it. Returns null if it
 * doesn't exist or the reporter can't see it (a message in someone else's
 * conversation), so a report can only ever be filed on content the reporter
 * was actually shown.
 */
export async function resolveReportTarget(
  targetType: ReportTargetTypeOption,
  targetId: string,
  reporterId: string
): Promise<ReportTarget | null> {
  switch (targetType) {
    case "USER": {
      const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, bio: true, photo: true } });
      if (!user) return null;
      return {
        ownerId: user.id,
        contentSnapshot: [user.name, user.bio].filter(Boolean).join(" — "),
        mediaSnapshot: user.photo,
        href: `/profile/${user.id}`,
      };
    }
    case "POST": {
      const post = await prisma.post.findUnique({ where: { id: targetId } });
      if (!post) return null;
      return {
        ownerId: post.userId,
        contentSnapshot: post.contentText,
        mediaSnapshot: post.photo ?? post.video,
        href: `/feed#post-${post.id}`,
      };
    }
    case "COMMENT": {
      const comment = await prisma.comment.findUnique({ where: { id: targetId } });
      if (!comment) return null;
      return {
        ownerId: comment.userId,
        contentSnapshot: comment.text,
        mediaSnapshot: null,
        href: `/feed#post-${comment.postId}`,
      };
    }
    case "MESSAGE": {
      const message = await prisma.message.findUnique({
        where: { id: targetId },
        include: { conversation: { select: { participants: { select: { userId: true } } } } },
      });
      if (!message) return null;
      const isParticipant = message.conversation.participants.some((p) => p.userId === reporterId);
      if (!isParticipant) return null;
      // No href: admins aren't participants, so they can't open the
      // conversation — the snapshot is all they get.
      return { ownerId: message.senderId, contentSnapshot: message.text, mediaSnapshot: null, href: null };
    }
    case "EVENT_NOTICE": {
      const notice = await prisma.eventNotice.findUnique({ where: { id: targetId } });
      if (!notice) return null;
      return {
        ownerId: notice.userId,
        contentSnapshot: notice.text,
        mediaSnapshot: null,
        href: `/events/${notice.eventId}/notices`,
      };
    }
    case "EVENT_NOTICE_COMMENT": {
      const comment = await prisma.eventNoticeComment.findUnique({
        where: { id: targetId },
        include: { notice: { select: { eventId: true } } },
      });
      if (!comment) return null;
      return {
        ownerId: comment.userId,
        contentSnapshot: comment.text,
        mediaSnapshot: null,
        href: `/events/${comment.notice.eventId}/notices`,
      };
    }
  }
}

/**
 * Deletes reported content. A no-op for USER reports (suspend the account
 * instead) and for content its author has already deleted.
 */
export async function removeReportTarget(targetType: ReportTargetTypeOption, targetId: string): Promise<void> {
  switch (targetType) {
    case "USER":
      return;
    case "POST":
      await prisma.post.deleteMany({ where: { id: targetId } });
      return;
    case "COMMENT":
      await prisma.comment.deleteMany({ where: { id: targetId } });
      return;
    case "MESSAGE":
      await prisma.message.deleteMany({ where: { id: targetId } });
      return;
    case "EVENT_NOTICE":
      await prisma.eventNotice.deleteMany({ where: { id: targetId } });
      return;
    case "EVENT_NOTICE_COMMENT":
      await prisma.eventNoticeComment.deleteMany({ where: { id: targetId } });
      return;
  }
}
