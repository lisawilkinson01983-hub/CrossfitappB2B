import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { formatEventDate } from "@/lib/eventDate";

export type ProfileEventRowData = {
  id: string;
  photo: string | null;
  name: string;
  date: Date;
  endDate: Date | null;
  isOnline: boolean;
  location: string | null;
};

/** One row in a profile's Comps tab (Competing in / Attending / Interested in). */
export function ProfileEventRow({ event }: { event: ProfileEventRowData }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3">
      <Avatar photo={event.photo} name={event.name} size={40} />
      <div>
        <p className="font-medium">
          <Link href={`/events/${event.id}`} className="hover:underline">
            {event.name}
          </Link>
        </p>
        <p className="text-sm text-b2b-ink/50">
          {formatEventDate(event)} · {event.isOnline ? "Online" : event.location}
        </p>
      </div>
    </div>
  );
}
