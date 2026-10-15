"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MaintenanceTrendPoint } from "@/app/dashboard/dashboard-data";

const PREVENTIVE_COLOR = "#2563eb";
const CORRECTIVE_COLOR = "#dc2626";

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: MaintenanceTrendPoint }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-slate-600">
        <span className="h-2 w-2 rounded-full" style={{ background: PREVENTIVE_COLOR }} />
        Preventivas: <strong className="text-slate-900">{point.preventivas}</strong>
      </p>
      <p className="flex items-center gap-1.5 text-slate-600">
        <span className="h-2 w-2 rounded-full" style={{ background: CORRECTIVE_COLOR }} />
        Corretivas: <strong className="text-slate-900">{point.corretivas}</strong>
      </p>
      {point.outras > 0 && (
        <p className="text-slate-500">Outras: {point.outras}</p>
      )}
      <p className="mt-1 border-t border-slate-100 pt-1 text-slate-600">
        Total: <strong className="text-slate-900">{point.total}</strong>
      </p>
    </div>
  );
}

export function MaintenanceTrendChart({ data }: { data: MaintenanceTrendPoint[] }) {
  const hasAny = data.some((point) => point.total > 0);

  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
        Nenhuma manutenção registrada nos últimos 12 meses.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            width={40}
          />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="preventivas"
            name="Preventivas"
            stroke={PREVENTIVE_COLOR}
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="corretivas"
            name="Corretivas"
            stroke={CORRECTIVE_COLOR}
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PREVENTIVE_COLOR }} />
          Preventivas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CORRECTIVE_COLOR }} />
          Corretivas
        </span>
      </div>
    </div>
  );
}
