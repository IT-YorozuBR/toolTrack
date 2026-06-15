import Link from "next/link";

export type BarItem = {
  label: string;
  value: number;
  /** Parcela "urgente"/destacada do valor (<= value). */
  highlight?: number;
  href?: string;
};

export function BarSeries({
  items,
  height = 160,
  baseColor = "bg-blue-500",
  highlightColor = "bg-orange-500",
  highlightLabel = "urg.",
}: {
  items: BarItem[];
  height?: number;
  baseColor?: string;
  highlightColor?: string;
  highlightLabel?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {items.map((item) => {
        const totalPct = Math.max(item.value > 0 ? 6 : 0, (item.value / max) * 100);
        const urgent = Math.min(item.highlight ?? 0, item.value);
        const urgentPct = item.value > 0 ? (urgent / item.value) * 100 : 0;

        const bar = (
          <div className="group flex h-full w-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-semibold tabular-nums text-slate-700">{item.value}</span>
            <div className="relative flex w-full max-w-12 flex-1 items-end">
              <div
                className="relative w-full overflow-hidden rounded-t-md transition-opacity group-hover:opacity-90"
                style={{ height: `${totalPct}%` }}
              >
                <div className={`absolute inset-0 ${baseColor}`} />
                {urgent > 0 && (
                  <div
                    className={`absolute inset-x-0 bottom-0 ${highlightColor}`}
                    style={{ height: `${urgentPct}%` }}
                  />
                )}
              </div>
              {urgent > 0 && (
                <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                  {urgent} {highlightLabel}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">{item.label}</span>
          </div>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} className="flex h-full flex-1">
            {bar}
          </Link>
        ) : (
          <div key={item.label} className="flex h-full flex-1">
            {bar}
          </div>
        );
      })}
    </div>
  );
}
