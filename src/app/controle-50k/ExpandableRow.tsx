"use client";

import { useState } from "react";
import type { ToolProjection } from "@/lib/calculations/strokes";
import type { WindowMonth } from "@/lib/calculations/strokes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatNumber } from "@/lib/utils";
import { RegisterMaintenanceButton } from "./RegisterMaintenanceButton";
import { ToolBreakdown } from "./ToolBreakdown";

type WindowDate = {
  key: string;
  label: string;
  planningLabel: string;
  offset: number;
};

export function ExpandableRow({
  p,
  windowDates,
}: {
  p: ToolProjection;
  windowDates: WindowDate[];
}) {
  const [expanded, setExpanded] = useState(false);

  const rowBg =
    p.status === "VENCIDO"
      ? "bg-red-50"
      : p.status === "PROGRAMAR_PREVENTIVA"
      ? "bg-orange-50"
      : "";

  return (
    <>
      <tr className={`${rowBg} hover:bg-gray-50`}>
        {/* Ferramental — first cell has expand button */}
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors text-xs"
              aria-label={expanded ? "Recolher breakdown" : "Expandir breakdown"}
              title={expanded ? "Recolher breakdown por produto" : "Expandir breakdown por produto"}
            >
              {expanded ? "▼" : "▶"}
            </button>
            <div>
              <p className="font-medium text-gray-900">{p.code}</p>
              {p.description && (
                <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
              )}
              {p.errors.length > 0 && (
                <p className="text-xs text-red-600 mt-0.5">⚠ {p.errors[0]}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-600">{p.press}</td>
        <td className="px-4 py-3 text-gray-600">{p.line ?? "—"}</td>
        <td className="px-4 py-3 text-right tabular-nums">
          {formatNumber(p.estimatedStrokes)}
        </td>
        {p.window.map((m: WindowMonth) => (
          <td
            key={m.key}
            className={`px-4 py-3 text-right tabular-nums text-xs ${
              m.offset === 0 ? "text-blue-700 font-medium" : "text-gray-700"
            }`}
          >
            {m.strokes > 0 ? formatNumber(Math.round(m.strokes)) : "—"}
          </td>
        ))}
        <td className="px-4 py-3 text-right tabular-nums font-semibold">
          {formatNumber(Math.round(p.totalProjectedStrokes))}
        </td>
        <td
          className={`px-4 py-3 text-right tabular-nums font-semibold ${
            p.remainingStrokes < 0
              ? "text-red-600"
              : p.remainingStrokes < 5000
              ? "text-orange-600"
              : "text-gray-900"
          }`}
        >
          {formatNumber(Math.round(p.remainingStrokes))}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={p.status} />
        </td>
        <td className="px-4 py-3 text-gray-600 text-xs">
          {p.reachesLimitInMonth ?? "—"}
        </td>
        <td className="px-4 py-3">
          {(p.status === "PROGRAMAR_PREVENTIVA" || p.status === "VENCIDO") && (
            <RegisterMaintenanceButton toolId={p.toolId} toolCode={p.code} />
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={14} className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <ToolBreakdown
              breakdown={p.productBreakdown}
              windowDates={windowDates.map((w) => ({ key: w.key, label: w.label }))}
            />
          </td>
        </tr>
      )}
    </>
  );
}
