"use client";

import { useEffect, useState } from "react";

type ThemeChoice = "light" | "dark" | "system";

function applyTheme(choice: ThemeChoice) {
  const isDark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Light/Dark/System switch — persists to localStorage and applies instantly (see the matching inline script in layout.tsx, which sets the initial class before first paint). */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") as ThemeChoice | null;
      if (stored === "light" || stored === "dark" || stored === "system") setChoice(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function select(value: ThemeChoice) {
    setChoice(value);
    applyTheme(value);
    try {
      localStorage.setItem("theme", value);
    } catch {}
  }

  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            choice === opt.value
              ? "border-b2b-pink bg-b2b-pink/10 text-b2b-pink"
              : "border-b2b-purple/10 text-b2b-ink/60 hover:border-b2b-pink/30"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
