"use client";

import { useEffect, useRef, useState } from "react";

// The logo gold. Checked for chart use against both the light (#fff) and
// dark (#333338) card surfaces — the lighter dark-mode accent token is too
// pale for a filled mark, so this fixed value is used in both modes.
const MARK = "#b8842a";

const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 22, left: 30 };

type Point = { day: string; value: number };

function formatDay(day: string, withWeekday = false) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    ...(withWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Up to 4 clean integer ticks from 0 to at least `max`. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow);
  const top = Math.ceil(max / step) * step;
  const out = [];
  for (let t = 0; t <= top; t += step) out.push(t);
  return out;
}

/**
 * One-series daily column chart. Hover, tap, or arrow keys (once focused)
 * show a day's value; every value is also in the table view below it.
 */
export function DailyBarChart({ data, unit }: { data: Point[]; unit: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const yTicks = ticks(Math.max(...data.map((d) => d.value)));
  const yMax = yTicks[yTicks.length - 1];
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = data.length ? plotW / data.length : 0;
  // <=24px columns with a 2px gap between neighbours.
  const barW = Math.max(1, Math.min(24, slot - 2));
  const radius = Math.min(4, barW / 2);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const labelIdx = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];
  const activePoint = active !== null ? data[active] : null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((i) => {
      if (i === null) return data.length - 1;
      return Math.min(data.length - 1, Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1)));
    });
  }

  return (
    <div>
      <div ref={wrapRef} className="relative w-full" onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${unit} per day. Focus and use the arrow keys to read each day.`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            className="block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-b2b-pink/50"
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="currentColor"
                  strokeOpacity={0.12}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 6}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-current text-[10px] tabular-nums opacity-50"
                >
                  {t}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const x = PAD.left + i * slot + (slot - barW) / 2;
              const top = y(d.value);
              const h = PAD.top + plotH - top;
              return (
                <g key={d.day}>
                  {d.value > 0 && (
                    // Rounded data-end, square at the baseline.
                    <path
                      d={`M${x},${top + h} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + barW - radius} Q${x + barW},${top} ${x + barW},${top + radius} V${top + h} Z`}
                      fill={MARK}
                      opacity={active === null || active === i ? 1 : 0.45}
                    />
                  )}
                  {/* Hit target: the whole slot, full height. */}
                  <rect
                    x={PAD.left + i * slot}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={() => setActive(i)}
                  />
                </g>
              );
            })}

            {labelIdx.map((i, n) => (
              <text
                key={i}
                x={PAD.left + i * slot + slot / 2}
                y={HEIGHT - 6}
                textAnchor={n === 0 && labelIdx.length > 1 ? "start" : n === labelIdx.length - 1 && n > 0 ? "end" : "middle"}
                className="fill-current text-[10px] opacity-50"
              >
                {formatDay(data[i].day)}
              </text>
            ))}
          </svg>
        )}

        {activePoint && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-b2b-purple/15 bg-b2b-card px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: Math.min(Math.max(PAD.left + active * slot + slot / 2, 60), width - 60),
            }}
          >
            <span className="font-semibold tabular-nums text-b2b-ink">{activePoint.value}</span>{" "}
            <span className="text-b2b-ink/60">{unit}</span>
            <div className="text-b2b-ink/50">{formatDay(activePoint.day, true)}</div>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-b2b-ink/60">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <table className="mt-2 w-full max-w-xs tabular-nums">
          <thead>
            <tr className="text-left text-b2b-ink/50">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.day} className="border-t border-b2b-purple/10">
                <td className="py-1">{formatDay(d.day, true)}</td>
                <td className="py-1 text-right text-b2b-ink">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
