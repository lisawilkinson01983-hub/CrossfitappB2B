import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { resultHeadline, placeMedal } from "@/lib/eventResults";

export type ProfileResultItem = {
  id: string;
  eventId: string;
  eventName: string;
  eventPhoto: string | null;
  createdAt: Date;
  placementType: "EXACT" | "COMPLETED";
  place: number | null;
  division: string | null;
};

/** The 2-column "trophy shelf" grid of logged results on a profile's Results tab. */
export function ProfileResultsGrid({ results }: { results: ProfileResultItem[] }) {
  if (results.length === 0) {
    return <p className="text-b2b-ink/40">No results logged yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {results.map((r) => {
        const medal = placeMedal(r.place);
        return (
          <Link
            key={r.id}
            href={`/events/${r.eventId}/results`}
            className="overflow-hidden rounded-xl bg-b2b-card shadow-sm"
          >
            <div className="relative h-24">
              {r.eventPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.eventPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-b2b-ink" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-b2b-pink px-2 py-0.5 text-[9.5px] font-extrabold text-white">
                {medal ? `${medal} ${resultHeadline(r)}` : resultHeadline(r)}
              </span>
              <p className="absolute bottom-1.5 left-2 right-2 text-[11.5px] font-extrabold leading-tight text-white">
                {r.eventName}
              </p>
            </div>
            <p className="px-2 py-1.5 text-[10px] text-b2b-ink/50">{formatDate(r.createdAt)}</p>
          </Link>
        );
      })}
    </div>
  );
}
