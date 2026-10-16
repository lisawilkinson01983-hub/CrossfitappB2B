"use client";

import { useRouter } from "next/navigation";
import { PbEditor, type PbEditorInitial } from "@/components/PbEditor";

/** Thin page wrapper around the existing PbEditor — same component the profile page's "Key PBs" card uses inline, just on its own dedicated page here. */
export function PbsEditorPage({ initial }: { initial: PbEditorInitial }) {
  const router = useRouter();
  return <PbEditor initial={initial} onSaved={() => router.push("/profile/edit")} />;
}
