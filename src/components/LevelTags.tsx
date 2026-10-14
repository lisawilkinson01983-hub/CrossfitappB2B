import { LEVEL_LABELS, LEVEL_TEXT_CLASSES } from "@/lib/labels";
import type { LevelOption } from "@/lib/validation";

/**
 * A compact "Rx" / "Rx / Int" tag for sitting inline right next to someone's
 * name (post headers, athlete lists) — plain colored text, not a pill, so it
 * doesn't compete with the name for space or wrap onto its own line the way
 * a full badge per level did. For a dedicated "Ability" section with room to
 * spare (see ProfileDetails), the full bordered pill (LEVEL_BADGE_CLASSES)
 * still applies — this is only for the tight inline case.
 */
export function LevelTags({ levels, className = "" }: { levels: LevelOption[]; className?: string }) {
  if (levels.length === 0) return null;
  return (
    <span className={`shrink-0 text-xs font-semibold ${className}`}>
      {levels.map((level, i) => (
        <span key={level}>
          {i > 0 && <span className="text-b2b-ink/25"> / </span>}
          <span className={LEVEL_TEXT_CLASSES[level]}>{LEVEL_LABELS[level]}</span>
        </span>
      ))}
    </span>
  );
}
