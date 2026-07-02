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

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

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
      : p.status === "ATENCAO"
      ? "bg-yellow-50"
      : "";

  return (
    <>
      <tr className={`${rowBg} hover:bg-gray-50`}>
        {/* Ferramental — first cell has expand button */}
        <td className="px-3 py-2">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[10px] text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label={expanded ? "Recolher breakdown" : "Expandir breakdown"}
              title={expanded ? "Recolher breakdown por produto" : "Expandir breakdown por produto"}
            >
              {expanded ? "▼" : "▶"}
            </button>
            <div>
              <p className="font-medium text-gray-900">{p.code}</p>
              {p.description && (
                <p className="mt-0.5 truncate text-[10px] text-gray-500" title={p.description}>
                  {p.description}
                </p>
              )}
              {p.errors.length > 0 && (
                <p className="mt-0.5 truncate text-[10px] text-red-600">⚠ {p.errors[0]}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 text-[10px] text-gray-600">
          {formatDate(p.lastMaintenanceDate)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          <span
            className={
              p.hasMaintenanceInReferenceMonth
                ? "inline-flex min-w-14 justify-end rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-800 ring-1 ring-blue-200"
                : ""
            }
            title={
              p.hasMaintenanceInReferenceMonth
                ? "Ferramental com manutenção registrada no mês de referência"
                : undefined
            }
          >
            {formatNumber(p.estimatedStrokes)}
          </span>
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          <span
            className={
              p.hasMaintenanceInReferenceMonth
                ? "inline-flex min-w-14 justify-end rounded bg-green-50 px-1.5 py-0.5 font-semibold text-green-800 ring-1 ring-green-200"
                : "text-gray-700"
            }
            title={
              p.hasMaintenanceInReferenceMonth
                ? "Batidas previstas restantes no mês após a manutenção registrada"
                : "Batidas previstas para o mês de referência"
            }
          >
            {formatNumber(Math.round(p.currentMonthRemainingStrokes))}
          </span>
        </td>
        {p.window.map((m: WindowMonth) => (
          <td
            key={m.key}
            className={`px-3 py-2 text-right tabular-nums ${
              m.offset === 0 ? "font-medium text-blue-700" : "text-gray-700"
            }`}
          >
            {m.strokes > 0 ? formatNumber(Math.round(m.strokes)) : "—"}
          </td>
        ))}
        <td className="px-3 py-2 text-right tabular-nums font-semibold">
          {formatNumber(Math.round(p.totalProjectedStrokes))}
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums font-semibold ${
            p.remainingStrokes < 0
              ? "text-red-600"
              : p.remainingStrokes < 5000
              ? "text-orange-600"
              : "text-gray-900"
          }`}
        >
          {formatNumber(Math.round(p.remainingStrokes))}
        </td>
        <td className="px-3 py-2">
          <StatusBadge status={p.status} size="sm" />
        </td>
        <td className="px-3 py-2 text-[10px] text-gray-600">
          {p.reachesLimitInMonth ?? "—"}
        </td>
        <td className="px-3 py-2">
          {(p.status === "PROGRAMAR_PREVENTIVA" || p.status === "VENCIDO") && (
            <RegisterMaintenanceButton toolId={p.toolId} toolCode={p.code} />
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={12} className="px-6 py-3 bg-gray-50 border-b border-gray-200">
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
