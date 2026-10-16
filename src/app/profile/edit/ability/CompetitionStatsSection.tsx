"use client";

import { useRouter } from "next/navigation";
import {
  CompetitionStatsQuickEditor,
  type CompetitionStatsQuickEditorInitial,
} from "@/components/CompetitionStatsQuickEditor";

/** Thin client wrapper so CompetitionStatsQuickEditor's Save/Cancel can return to the edit-profile hub, same as the PBs page does for PbEditor. */
export function CompetitionStatsSection({ initial }: { initial: CompetitionStatsQuickEditorInitial }) {
  const router = useRouter();
  return <CompetitionStatsQuickEditor initial={initial} onSaved={() => router.push("/profile/edit")} />;
}
