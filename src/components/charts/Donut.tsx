"use client";

import { useState } from "react";

import { formatNumber } from "@/lib/utils";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export function Donut({
  slices,
  size = 168,
  thickness = 22,
  centerValue,
  centerLabel,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const fractionOf = (value: number) => (total > 0 ? value / total : 0);
  const drawable = slices.filter((slice) => slice.value > 0);
  const segments = drawable.map((slice, index) => {
    const dash = fractionOf(slice.value) * circumference;
    // Offset acumulado = soma das fatias anteriores (sem reatribuir variável no render).
    const offset = drawable
      .slice(0, index)
      .reduce((sum, prev) => sum + fractionOf(prev.value) * circumference, 0);
    return { slice, dash, gap: circumference - dash, offset };
  });

  const focused = active ? slices.find((slice) => slice.key === active) : null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />
          {segments.map(({ slice, dash, gap, offset: segOffset }) => {
            const dimmed = active !== null && active !== slice.key;
            return (
              <circle
                key={slice.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={active === slice.key ? thickness + 4 : thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-segOffset}
                strokeLinecap="butt"
                className="cursor-pointer transition-[stroke-width,opacity]"
                style={{ opacity: dimmed ? 0.35 : 1 }}
                onMouseEnter={() => setActive(slice.key)}
                onMouseLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums text-slate-900">
            {focused ? formatNumber(focused.value) : centerValue ?? formatNumber(total)}
          </span>
          <span className="mt-0.5 max-w-[7rem] text-xs text-slate-500">
            {focused ? focused.label : centerLabel ?? "Total"}
          </span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-1 gap-1.5 text-sm">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          const dimmed = active !== null && active !== slice.key;
          return (
            <li
              key={slice.key}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-slate-50"
              style={{ opacity: dimmed ? 0.45 : 1 }}
              onMouseEnter={() => setActive(slice.key)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                {slice.label}
              </span>
              <span className="tabular-nums text-slate-900">
                <strong>{formatNumber(slice.value)}</strong>
                <span className="ml-1 text-xs text-slate-400">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
