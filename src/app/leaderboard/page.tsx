import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { TestGroupInput } from "@/components/TestGroupInput";
import { buildLeaderboard } from "@/lib/leaderboard";

const RANGES = { "7": 7, "30": 30 } as const;
type RangeOption = keyof typeof RANGES;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; group?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const sp = await searchParams;
  const range = (Object.keys(RANGES) as RangeOption[]).find((r) => r === sp.range);
  const group = typeof sp.group === "string" && sp.group ? sp.group : undefined;
  const since = range ? new Date(Date.now() - RANGES[range] * 86400000) : undefined;

  const [rows, groupOptionRows] = await Promise.all([
    buildLeaderboard({ since, testGroup: group }),
    prisma.user.findMany({
      where: { testGroup: { not: null } },
      select: { testGroup: true },
      distinct: ["testGroup"],
    }),
  ]);
  const groupOptions = groupOptionRows.map((r) => r.testGroup as string).sort();

  const columns: { key: keyof (typeof rows)[number]; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "workouts", label: "Workouts" },
    { key: "comments", label: "Comments" },
    { key: "likes", label: "Likes" },
    { key: "messages", label: "Msgs" },
    { key: "eventActivity", label: "Events" },
    { key: "referrals", label: "Invites" },
    { key: "loginDays", label: "Login days" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to settings
      </Link>

      <h1 className="mt-3 text-2xl font-bold">Activity Leaderboard</h1>
      <p className="mt-1 text-sm text-b2b-ink/50">
        Every column is a straight count of that activity. Total is an unweighted sum — use the breakdown, not just
        the total, to judge who's actually earned a prize.
      </p>

      <div className="mt-4">
        <SectionCard>
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="range" className="block text-xs font-medium text-b2b-ink/60">
                Time range
              </label>
              <select
                id="range"
                name="range"
                defaultValue={range ?? ""}
                className="mt-1 rounded border border-gray-300 bg-b2b-card px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
              >
                <option value="">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
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
                <option value="">All groups</option>
                {groupOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded bg-b2b-pink px-4 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Apply
            </button>
          </form>
        </SectionCard>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-b2b-purple/10 bg-b2b-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-b2b-purple/10 text-left text-xs uppercase tracking-wide text-b2b-ink/50">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Athlete</th>
              <th className="px-3 py-2">Group</th>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 4} className="px-3 py-6 text-center text-b2b-ink/40">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id} className="border-b border-b2b-purple/5 last:border-0">
                  <td className="px-3 py-2 text-b2b-ink/50">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/profile/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-xs text-b2b-ink/40">{row.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <TestGroupInput userId={row.id} initialValue={row.testGroup} />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-right">
                      {row[c.key] as number}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold text-b2b-pink">{row.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
