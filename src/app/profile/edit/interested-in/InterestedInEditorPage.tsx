"use client";

import { useRouter } from "next/navigation";
import { InterestedInEditor, type InterestedInEditorInitial } from "@/components/InterestedInEditor";

/** Thin page wrapper around InterestedInEditor, returning to the edit-profile hub after a save. */
export function InterestedInEditorPage({ initial }: { initial: InterestedInEditorInitial }) {
  const router = useRouter();
  return <InterestedInEditor initial={initial} onSaved={() => router.push("/profile/edit")} />;
}
