"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  // URL atual (com filtros/ordenação) para o botão "Voltar" das páginas de
  // produto/projeto retornar exatamente para esta visão do Controle 50K.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const backTo = encodeURIComponent(`${pathname}${qs ? `?${qs}` : ""}`);
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
          <th className="text-left py-1 pr-4 font-medium">Projetos</th>
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
              <td className="py-1 pr-4 font-mono">
                <Link
                  href={`/bom?produto=${prod.productId}&back=${backTo}`}
                  className="text-blue-600 hover:underline"
                  title={`Abrir o produto ${prod.productCode} (BOM)`}
                >
                  {prod.productCode}
                </Link>
              </td>
              <td className="py-1 pr-4">
                {prod.projects.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {prod.projects.map((proj) => (
                      <Link
                        key={proj.id}
                        href={`/projetos?projeto=${proj.id}&back=${backTo}`}
                        title={`Abrir o projeto ${proj.name}`}
                        className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 hover:ring-indigo-300"
                      >
                        {proj.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-300 italic">sem projeto</span>
                )}
              </td>
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
