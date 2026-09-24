"use client";

import { useState } from "react";

export function WorkoutDescriptionToggle({ description }: { description: string }) {
  const [show, setShow] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="text-sm font-medium text-b2b-pink hover:underline"
      >
        {show ? "Hide workout description" : "Show workout description"}
      </button>
      {show && <p className="mt-1 text-sm italic text-gray-600">{description}</p>}
    </div>
  );
}
