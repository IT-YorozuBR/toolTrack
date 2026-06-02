"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/utils";

type MaintenanceRecord = {
  id: string;
  maintenanceDate: Date;
  strokesAtMaintenance: number;
  maintenanceType: string;
  responsible: string | null;
  resetCounter: boolean;
  notes: string | null;
};

type Tool = {
  id: string;
  code: string;
  description: string | null;
  press: string;
  line: string | null;
  maintenanceRecords: MaintenanceRecord[];
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR");
}

function TypeBadge({ type }: { type: string }) {
  const color =
    type === "Preventiva"
      ? "bg-green-100 text-green-800"
      : type === "Corretiva"
      ? "bg-red-100 text-red-800"
      : "bg-blue-100 text-blue-800";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      {type}
    </span>
  );
}

export function ManutencaoRow({ tool }: { tool: Tool }) {
  const [expanded, setExpanded] = useState(false);
  const last = tool.maintenanceRecords[0];
  const count = tool.maintenanceRecords.length;

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-3 py-2.5">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              disabled={count === 0}
              className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[10px] text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={expanded ? "Recolher" : "Expandir"}
            >
              {expanded ? "▼" : "▶"}
            </button>
            <div>
              <p className="font-medium text-gray-900 text-[11px]">{tool.code}</p>
              {tool.description && (
                <p className="mt-0.5 truncate text-[10px] text-gray-500" title={tool.description}>
                  {tool.description}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-[11px] text-gray-600">{tool.press}</td>
        <td className="px-3 py-2.5 text-center">
          {count > 0 ? (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
              {count}
            </span>
          ) : (
            <span className="text-[10px] text-gray-300">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-[11px] text-gray-600">
          {last ? formatDate(last.maintenanceDate) : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2.5">
          {last ? <TypeBadge type={last.maintenanceType} /> : <span className="text-[10px] text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-[11px] text-gray-700">
          {last ? formatNumber(last.strokesAtMaintenance) : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2.5 text-[10px]">
          {last ? (
            last.resetCounter ? (
              <span className="text-green-600 font-medium">✓ Zerado</span>
            ) : (
              <span className="text-gray-400">—</span>
            )
          ) : null}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 border-b border-gray-200 px-8 py-3">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-[10px] font-medium text-gray-500 uppercase">Data</th>
                  <th className="pb-2 text-right text-[10px] font-medium text-gray-500 uppercase">Batidas</th>
                  <th className="pb-2 text-left text-[10px] font-medium text-gray-500 uppercase pl-3">Tipo</th>
                  <th className="pb-2 text-left text-[10px] font-medium text-gray-500 uppercase pl-3">Responsável</th>
                  <th className="pb-2 text-left text-[10px] font-medium text-gray-500 uppercase pl-3">Contador</th>
                  <th className="pb-2 text-left text-[10px] font-medium text-gray-500 uppercase pl-3">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tool.maintenanceRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-white">
                    <td className="py-1.5 text-gray-700">{formatDate(r.maintenanceDate)}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-700">{formatNumber(r.strokesAtMaintenance)}</td>
                    <td className="py-1.5 pl-3"><TypeBadge type={r.maintenanceType} /></td>
                    <td className="py-1.5 pl-3 text-gray-600">{r.responsible ?? "—"}</td>
                    <td className="py-1.5 pl-3">
                      {r.resetCounter ? (
                        <span className="text-green-600 font-medium">✓ Zerado</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pl-3 text-gray-500 max-w-xs truncate" title={r.notes ?? undefined}>
                      {r.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
