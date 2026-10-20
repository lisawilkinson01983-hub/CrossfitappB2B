import Link from "next/link";

export type DiscoverView = "athletes" | "events" | "affiliates" | "teammates";

const TABS: { view: DiscoverView; label: string }[] = [
  { view: "athletes", label: "Athletes" },
  { view: "events", label: "Events" },
  { view: "affiliates", label: "Affiliates" },
  { view: "teammates", label: "Teammates" },
];

/**
 * Discover's own view switcher — shared by each tab's search component (not
 * rendered once by the parent page) so a tab's search-icon trigger can sit
 * on the same row as the tabs themselves, instead of a separate search bar
 * underneath eating its own line. `overflow-x-auto` + `whitespace-nowrap`
 * keeps four labels plus that icon from wrapping on a narrow phone.
 */
export function DiscoverTabs({ active }: { active: DiscoverView }) {
  return (
    <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto whitespace-nowrap text-sm font-medium">
      {TABS.map((tab) => (
        <Link
          key={tab.view}
          href={`/discover?view=${tab.view}`}
          className={`pb-2 ${active === tab.view ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-gray-500"}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
