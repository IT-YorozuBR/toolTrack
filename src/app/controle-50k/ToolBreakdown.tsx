"use client";

import type { ProductContribution } from "@/lib/calculations/strokes";
import { formatNumber } from "@/lib/utils";

type WindowDate = {
  key: string;
  label: string;
};

export function ToolBreakdown({
  breakdown,
  windowDates,
}: {
  breakdown: ProductContribution[];
  windowDates: WindowDate[];
}) {
  if (breakdown.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic py-1">
        Nenhum produto vinculado via BOM.
      </p>
    );
  }

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="text-gray-500">
          <th className="text-left py-1 pr-4 font-medium">Produto</th>
          {windowDates.map((w) => (
            <th key={w.key} className="text-right py-1 px-2 font-medium whitespace-nowrap">
              {w.label}
            </th>
          ))}
          <th className="text-right py-1 pl-4 font-medium">Total (janela)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {breakdown.map((prod) => {
          const windowTotal = windowDates.reduce(
            (sum, w) => sum + (prod.strokesByMonth[w.key] ?? 0),
            0,
          );
          return (
            <tr key={prod.productId} className="hover:bg-white">
              <td className="py-1 pr-4 font-mono text-gray-700">{prod.productCode}</td>
              {windowDates.map((w) => {
                const val = prod.strokesByMonth[w.key] ?? 0;
                return (
                  <td key={w.key} className="text-right py-1 px-2 tabular-nums text-gray-600">
                    {val > 0 ? formatNumber(Math.round(val)) : "—"}
                  </td>
                );
              })}
              <td className="text-right py-1 pl-4 tabular-nums font-semibold text-gray-700">
                {windowTotal > 0 ? formatNumber(Math.round(windowTotal)) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
