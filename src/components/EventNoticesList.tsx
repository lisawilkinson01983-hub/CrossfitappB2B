"use client";

import { useMemo, useState } from "react";
import { EventNoticeCard, type EventNoticeData } from "./EventNoticeCard";
import {
  TEAMMATE_DIVISIONS,
  TEAMMATE_GENDERS,
  type TeammateDivisionOption,
  type TeammateGenderOption,
} from "@/lib/validation";
import { TEAMMATE_DIVISION_LABELS, TEAMMATE_GENDER_LABELS } from "@/lib/labels";

export type EventNoticeEntry = {
  notice: EventNoticeData;
  isOwn: boolean;
  isAuthorParticipating: boolean;
};

export function EventNoticesList({ notices }: { notices: EventNoticeEntry[] }) {
  const [gender, setGender] = useState<TeammateGenderOption | "ALL">("ALL");
  const [division, setDivision] = useState<TeammateDivisionOption | "ALL">("ALL");

  const filtering = gender !== "ALL" || division !== "ALL";

  const filtered = useMemo(() => {
    if (!filtering) return notices;
    return notices.filter(({ notice }) => {
      if (notice.teammateGender === null || notice.teammateDivision === null) return false;
      const genderMatches = gender === "ALL" || notice.teammateGender === "ANY" || notice.teammateGender === gender;
      const divisionMatches =
        division === "ALL" || notice.teammateDivision === "ANY" || notice.teammateDivision === division;
      return genderMatches && divisionMatches;
    });
  }, [notices, gender, division, filtering]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3">
        <p className="text-xs font-medium text-b2b-ink/50">🔎 Find a team looking for someone like you</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="filter-gender" className="block text-xs font-medium text-b2b-ink/60">
              I am
            </label>
            <select
              id="filter-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as TeammateGenderOption | "ALL")}
              className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-2 py-2 focus:border-b2b-pink focus:outline-none"
            >
              <option value="ALL">Any gender</option>
              {TEAMMATE_GENDERS.filter((g) => g !== "ANY").map((g) => (
                <option key={g} value={g}>
                  {TEAMMATE_GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-division" className="block text-xs font-medium text-b2b-ink/60">
              My division
            </label>
            <select
              id="filter-division"
              value={division}
              onChange={(e) => setDivision(e.target.value as TeammateDivisionOption | "ALL")}
              className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-2 py-2 focus:border-b2b-pink focus:outline-none"
            >
              <option value="ALL">Any division</option>
              {TEAMMATE_DIVISIONS.filter((d) => d !== "ANY").map((d) => (
                <option key={d} value={d}>
                  {TEAMMATE_DIVISION_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setGender("ALL");
              setDivision("ALL");
            }}
            className="mt-2 text-xs font-medium text-b2b-pink hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-b2b-ink/40">
          {filtering ? "No teams looking for that right now." : "No notices yet — be the first to post one."}
        </p>
      ) : (
        filtered.map(({ notice, isOwn, isAuthorParticipating }) => (
          <EventNoticeCard key={notice.id} notice={notice} isOwn={isOwn} isAuthorParticipating={isAuthorParticipating} />
        ))
      )}
    </div>
  );
}
