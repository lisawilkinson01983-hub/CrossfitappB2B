"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/Avatar";

type Profile = {
  id: string;
  name: string;
  photo: string | null;
  accountType: "ATHLETE" | "AFFILIATE";
  shared: boolean;
};

export function ProfileSwitcherList({
  profiles,
  activeProfileId,
}: {
  profiles: Profile[];
  activeProfileId: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(profileId: string) {
    setSwitching(profileId);
    setError(null);

    const res = await fetch("/api/account/switch-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't switch profiles. Please try again.");
      setSwitching(null);
      return;
    }

    await update({ switchToProfileId: profileId });
    router.push("/feed");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {profiles.map((profile) => {
        const isActive = profile.id === activeProfileId;
        return (
          <div
            key={profile.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar photo={profile.photo} name={profile.name} size={40} />
              <div className="min-w-0">
                <p className="truncate font-medium text-b2b-ink">{profile.name}</p>
                <p className="text-xs text-b2b-ink/50">
                  {profile.accountType === "AFFILIATE" ? "Affiliate" : "Athlete"}
                  {profile.shared && " · Shared with you"}
                </p>
              </div>
            </div>
            {isActive ? (
              <span className="shrink-0 rounded-full bg-b2b-pink/10 px-3 py-1 text-xs font-medium text-b2b-pink">
                Active
              </span>
            ) : (
              <button
                type="button"
                onClick={() => switchTo(profile.id)}
                disabled={switching !== null}
                className="shrink-0 rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
              >
                {switching === profile.id ? "Switching..." : "Switch"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
