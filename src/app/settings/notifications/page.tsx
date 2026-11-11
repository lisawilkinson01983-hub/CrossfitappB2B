import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { NOTIFICATION_SECTIONS, isEnabled, parseNotificationPrefs } from "@/lib/notificationSettings";
import { NotificationSettingRow } from "./NotificationSettingRow";

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true, accountType: true, notificationPrefs: true },
  });
  if (!user) redirect("/login");
  const prefs = parseNotificationPrefs(user.notificationPrefs);

  const sections = NOTIFICATION_SECTIONS.map((section) => ({
    ...section,
    settings: section.settings.filter(
      (s) =>
        !s.audience || (s.audience === "admin" && user.isAdmin) || (s.audience === "affiliate" && user.accountType === "AFFILIATE")
    ),
  })).filter((section) => section.settings.length > 0);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/settings" className="mt-6">Settings</BackLink>
      <h1 className="mt-4 text-2xl font-bold">Notifications</h1>
      <p className="mt-2 text-sm text-b2b-ink/60">
        Choose what you hear about. <span className="font-medium text-b2b-ink/80">Push</span> is an alert on your phone
        from the Box 2 Box app; <span className="font-medium text-b2b-ink/80">In app</span> is your notifications list
        and its red dot. These settings are for this profile only.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {sections.map((section) => (
          <SectionCard key={section.title} title={section.title}>
            <div className="-mt-2 mb-1 flex justify-end gap-3 text-[10px] font-semibold uppercase tracking-wide text-b2b-ink/40">
              <span className="w-11 text-center">Push</span>
              <span className="w-11 text-center">In app</span>
            </div>
            <div className="flex flex-col divide-y divide-b2b-purple/10">
              {section.settings.map((s) => (
                <NotificationSettingRow
                  key={s.key}
                  settingKey={s.key}
                  label={s.label}
                  description={s.description}
                  push={isEnabled(prefs, s.key, "push")}
                  inApp={s.pushOnly || s.inAppLocked ? null : isEnabled(prefs, s.key, "inApp")}
                />
              ))}
            </div>
          </SectionCard>
        ))}
      </div>

      <p className="mt-6 text-xs text-b2b-ink/50">
        To turn off all phone alerts, or the number on the app icon, use your phone&apos;s own settings: Settings →
        Notifications → Box 2 Box.
      </p>
    </main>
  );
}
