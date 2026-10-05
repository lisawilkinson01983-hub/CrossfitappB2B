"use client";

import { useEffect, useRef, useState } from "react";

type GifResult = {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

/**
 * A small popover: search box + a grid of GIF results from Tenor (see
 * /api/gifs/search). Click one to pick it — the caller decides what happens
 * next (attach to a message/comment draft, or send immediately).
 */
export function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
        const body = await res.json();
        setResults(body.results ?? []);
        setNotConfigured(Boolean(body.error) && body.results?.length === 0 && query === "");
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 z-20 mb-2 flex w-80 flex-col gap-2 rounded-xl border border-b2b-purple/15 bg-white p-3 shadow-lg"
    >
      <input
        type="text"
        autoFocus
        placeholder="Search GIFs..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
      />

      <div className="max-h-64 overflow-y-auto">
        {notConfigured ? (
          <p className="py-6 text-center text-sm text-b2b-ink/40">GIF search isn&apos;t set up yet.</p>
        ) : loading ? (
          <p className="py-6 text-center text-sm text-b2b-ink/40">Loading...</p>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-sm text-b2b-ink/40">No GIFs found.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(gif.url)}
                className="aspect-square overflow-hidden rounded bg-gray-100 hover:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- external, unsized GIF thumbnails from Tenor */}
                <img src={gif.previewUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
