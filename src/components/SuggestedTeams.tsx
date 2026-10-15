import type { SuggestedTeam } from "@/lib/teamSuggestions";
import { MessageTeamButton } from "@/components/MessageTeamButton";
import { Avatar } from "@/components/Avatar";

const CONFIDENCE_LABEL = { great: "Great fit", good: "Good fit" } as const;
const CONFIDENCE_CLASSES = {
  great: "bg-[#5B7A52]/10 text-[#4E6B46] ring-1 ring-inset ring-[#5B7A52]/25",
  good: "bg-b2b-pink/10 text-b2b-pink-dark ring-1 ring-inset ring-b2b-pink/25",
} as const;

/**
 * "Suggested full teams" — only shown for a Male- or Female-pairs/teams
 * event where the viewer is interested and has no team yet (see the
 * find-a-teammate page, which decides whether to render this at all and
 * builds the teams via src/lib/teamSuggestions.ts). Each card's "Message
 * this team" button opens a group chat with the other suggested members —
 * see MessageTeamButton for why it messages rather than commits anyone to
 * anything.
 */
export function SuggestedTeams({ teams, eventName }: { teams: SuggestedTeam[]; eventName: string }) {
  if (teams.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">Suggested full teams</p>
        <p className="mt-0.5 text-[11px] text-b2b-ink/40">
          Built from who&rsquo;s interested and still teamless, grouped by location and ability.
        </p>
      </div>

      {teams.map((team, i) => {
        const otherMemberIds = team.members.slice(1).map((m) => m.id);
        const starterMessage = `Hey! Box 2 Box suggested us as a team for ${eventName} — want to team up?`;

        return (
          <div key={i} className="rounded-2xl border border-b2b-purple/10 bg-b2b-card p-4 shadow-sm shadow-b2b-purple/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-base text-b2b-ink">{team.members.length}-person team</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${CONFIDENCE_CLASSES[team.confidence]}`}>
                {CONFIDENCE_LABEL[team.confidence]}
              </span>
            </div>

            <div className="mt-3 flex items-center">
              {team.members.map((member, idx) => (
                <div
                  key={member.id}
                  className="shrink-0 rounded-full ring-2 ring-b2b-card"
                  style={{ marginLeft: idx === 0 ? 0 : -10, zIndex: team.members.length - idx }}
                >
                  <Avatar photo={member.photo} name={member.name} size={40} />
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              {team.members.map((member, idx) => (
                <div key={member.id} className="flex items-center justify-between text-sm">
                  <span className={idx === 0 ? "font-semibold text-b2b-ink" : "text-b2b-ink/80"}>
                    {idx === 0 ? "You" : member.name}
                  </span>
                  {member.openLevel != null && <span className="text-xs text-b2b-ink/45">Level {member.openLevel}</span>}
                </div>
              ))}
            </div>

            <p className="mt-3 border-t border-b2b-purple/10 pt-3 text-xs leading-relaxed text-b2b-ink/50">
              {team.avgOpenLevel != null && `Avg Open Level ${team.avgOpenLevel}`}
              {team.avgOpenLevel != null && team.maxSpreadMiles != null && " · "}
              {team.maxSpreadMiles != null &&
                `${team.maxSpreadMiles < 1 ? "<1" : Math.round(team.maxSpreadMiles)} mi spread`}
              {team.avgOpenLevel == null && team.maxSpreadMiles == null && "Not enough data to size this up yet."}
            </p>

            <div className="mt-3">
              <MessageTeamButton
                memberIds={otherMemberIds}
                starterMessage={starterMessage}
                variant={i === 0 ? "primary" : "secondary"}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
