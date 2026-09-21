"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RequestItem = {
  id: string;
  requester: { id: string; name: string };
};

export function IncomingFollowRequests({ requests }: { requests: RequestItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function respond(id: string, action: "accept" | "decline") {
    setBusyId(id);
    const res = await fetch(`/api/follow-requests/${id}/${action}`, { method: "POST" });
    setBusyId(null);
    if (res.ok) router.refresh();
  }

  if (requests.length === 0) return null;

  return (
    <div className="mt-8 rounded border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-500">Follow requests</h2>
      <div className="mt-2 flex flex-col gap-2">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between text-sm">
            <span>{req.requester.name}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => respond(req.id, "accept")}
                disabled={busyId === req.id}
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => respond(req.id, "decline")}
                disabled={busyId === req.id}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
