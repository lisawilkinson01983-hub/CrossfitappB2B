import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { buildStats, type Stats } from "@/lib/stats";
import { DailyBarChart } from "./DailyBarChart";

const RANGES = [7, 30, 90] as const;

// Same gold as DailyBarChart — checked against both light and dark cards.
const MARK = "#b8842a";

function pct(n: number | null) {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function formatWeek(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; group?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.range) ?? 30;
  const group = typeof sp.group === "string" && sp.group ? sp.group : undefined;

  const [stats, groupOptionRows] = await Promise.all([
    buildStats({ days, testGroup: group }),
    prisma.user.findMany({ where: { testGroup: { not: null } }, select: { testGroup: true }, distinct: ["testGroup"] }),
  ]);
  const groupOptions = groupOptionRows.map((r) => r.testGroup as string).sort();

  return (
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/settings/admin" className="mt-6">Admin</BackLink>

      <h1 className="mt-3 text-2xl font-bold">Stats</h1>
      <p className="mt-1 text-sm text-b2b-ink/50">
        Counts people, not profiles. &ldquo;Active&rdquo; means they opened the app that day (UK time).
      </p>

      {/* Filters: one row, scoping everything below. */}
      <form method="GET" className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="range" className="block text-xs font-medium text-b2b-ink/60">
            Time range
          </label>
          <select
            id="range"
            name="range"
            defaultValue={String(days)}
            className="mt-1 rounded border border-gray-300 bg-b2b-card px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
          >
            {RANGES.map((r) => (
              <option key={r} value={r}>
                Last {r} days
              </option>
            ))}
          </select>
        </div>
        {groupOptions.length > 0 && (
          <div>
            <label htmlFor="group" className="block text-xs font-medium text-b2b-ink/60">
              Test group
            </label>
            <select
              id="group"
              name="group"
              defaultValue={group ?? ""}
              className="mt-1 rounded border border-gray-300 bg-b2b-card px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
            >
              <option value="">Everyone</option>
              {groupOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="submit"
          className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
        >
          Apply
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-4">
        <Headline stats={stats} />

        <SectionCard title={`People active each day`}>
          <DailyBarChart data={stats.daily.map((d) => ({ day: d.day, value: d.active }))} unit="active" />
        </SectionCard>

        <SectionCard title={`New sign-ups each day`}>
          <DailyBarChart data={stats.daily.map((d) => ({ day: d.day, value: d.signups }))} unit="sign-ups" />
          <p className="mt-2 text-xs text-b2b-ink/50">
            {stats.invitedSignups} of {stats.signups} sign-ups in this period used someone&apos;s invite code.
          </p>
        </SectionCard>

        <SectionCard title="What active people did">
          <p className="mb-3 text-xs text-b2b-ink/50">
            Of the {stats.activeInRange} {stats.activeInRange === 1 ? "person" : "people"} active in the last {days}{" "}
            days, how many did each at least once.
          </p>
          <div className="flex flex-col gap-2.5">
            {stats.adoption.map((a) => {
              const share = stats.activeInRange ? a.people / stats.activeInRange : 0;
              return (
                <div key={a.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-b2b-ink/80">{a.label}</span>
                    <span className="tabular-nums">
                      <span className="font-semibold text-b2b-ink">{pct(share)}</span>{" "}
                      <span className="text-xs text-b2b-ink/50">({a.people})</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-b2b-purple/10">
                    {share > 0 && (
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.max(share * 100, 2)}%`, backgroundColor: MARK }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Activity">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-b2b-ink/50">
                <th className="pb-2 font-medium" />
                <th className="pb-2 text-right font-medium">Last {days} days</th>
                <th className="pb-2 text-right font-medium">Period before</th>
              </tr>
            </thead>
            <tbody>
              {stats.activity.map((a) => (
                <tr key={a.key} className="border-t border-b2b-purple/10">
                  <td className="py-2 text-b2b-ink/80">{a.label}</td>
                  <td className="py-2 text-right">
                    <span className="font-semibold text-b2b-ink">{a.current}</span>
                    <Change current={a.current} previous={a.previous} />
                  </td>
                  <td className="py-2 text-right text-b2b-ink/50">{a.previous}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Do people come back?">
          <p className="mb-3 text-xs text-b2b-ink/50">
            People grouped by the week they signed up, and the share who used the app again 1, 2, 3 and 4 weeks
            later. &ldquo;—&rdquo; means that week hasn&apos;t finished yet.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums sm:text-sm">
              <thead>
                <tr className="text-left text-xs text-b2b-ink/50">
                  <th className="pb-2 font-medium">Joined w/c</th>
                  <th className="pb-2 text-right font-medium">People</th>
                  {[1, 2, 3, 4].map((k) => (
                    <th key={k} className="pb-2 text-center font-medium">
                      Wk {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...stats.cohorts].reverse().map((c) => (
                  <tr key={c.weekStart} className="border-t border-b2b-purple/10">
                    <td className="py-1.5 text-b2b-ink/80">{formatWeek(c.weekStart)}</td>
                    <td className="py-1.5 pr-1 text-right text-b2b-ink">{c.size}</td>
                    {c.weeks.map((rate, k) => (
                      <td key={k} className="p-0.5">
                        <div
                          className="rounded py-1 text-center text-b2b-ink"
                          // One-hue sequential tint behind ink text: darker = more people came back.
                          style={
                            rate !== null
                              ? { backgroundColor: `color-mix(in srgb, ${MARK} ${Math.round(8 + rate * 52)}%, transparent)` }
                              : undefined
                          }
                        >
                          {c.size ? pct(rate) : ""}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function Headline({ stats }: { stats: Stats }) {
  const tiles: { label: string; value: string; note?: React.ReactNode }[] = [
    { label: "Members", value: String(stats.totalMembers) },
    {
      label: `New in last ${stats.days} days`,
      value: String(stats.signups),
      note: <Change current={stats.signups} previous={stats.previousSignups} suffix="vs period before" />,
    },
    { label: "Active today", value: String(stats.activeToday) },
    { label: "Active this week", value: String(stats.active7), note: "last 7 days" },
    { label: "Active this month", value: String(stats.active30), note: "last 30 days" },
    {
      label: "Came back in first week",
      value: pct(stats.firstWeekReturn.rate),
      note: `of ${stats.firstWeekReturn.eligible} who joined 7+ days ago`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-[16px] border border-b2b-purple/15 bg-b2b-card p-4">
          <p className="text-xs text-b2b-ink/60">{t.label}</p>
          <p className="mt-1 text-2xl font-semibold text-b2b-ink">{t.value}</p>
          {t.note && <p className="mt-0.5 text-xs text-b2b-ink/50">{t.note}</p>}
        </div>
      ))}
    </div>
  );
}

/** Signed change vs the previous period — direction carried by the arrow, in text colour so it reads in both themes. */
function Change({ current, previous, suffix }: { current: number; previous: number; suffix?: string }) {
  const diff = current - previous;
  if (diff === 0) return suffix ? <span>No change {suffix}</span> : null;
  const up = diff > 0;
  return (
    <span className="ml-1.5 text-xs text-b2b-ink/60">
      {up ? "▲" : "▼"} {Math.abs(diff)}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}
