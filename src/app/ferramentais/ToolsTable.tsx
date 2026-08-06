"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Tool } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { MaintenanceStatus } from "@/lib/calculations/strokes";
import { formatNumber } from "@/lib/utils";
import { ToolActions } from "./ToolActions";
import { getToolIdsBySearch, bulkSetToolsActive } from "@/lib/actions/tools";

type Row = {
  tool: Tool;
  accumulated: number;
  status: MaintenanceStatus;
};

export function ToolsTable({
  rows,
  searchTerm,
  pagination,
}: {
  rows: Row[];
  searchTerm: string;
  pagination?: React.ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Seleção é estado local: navegar para outra página/busca reinicia a seleção.
  useEffect(() => {
    setSelected(new Set());
  }, [searchTerm]);

  const pageIds = rows.map((r) => r.tool.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = !allPageSelected && somePageSelected;
    }
  }, [allPageSelected, somePageSelected]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleHeaderToggle() {
    if (selected.size > 0) {
      setSelected(new Set());
      return;
    }
    setError(null);
    startTransition(async () => {
      const ids = await getToolIdsBySearch(searchTerm);
      setSelected(new Set(ids));
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function applyBulk(active: boolean) {
    const ids = Array.from(selected);
    const verb = active ? "ativar" : "desativar";
    if (!window.confirm(`${active ? "Ativar" : "Desativar"} ${ids.length} ferramental(is) selecionado(s)?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await bulkSetToolsActive(ids, active);
      if (!result.success) {
        setError(result.error ?? `Erro ao ${verb} os ferramentais selecionados.`);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-900">{selected.size} selecionado(s)</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyBulk(false)}
              disabled={pending}
              className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {pending ? "..." : "Desativar selecionados"}
            </button>
            <button
              type="button"
              onClick={() => applyBulk(true)}
              disabled={pending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {pending ? "..." : "Ativar selecionados"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={pending}
              className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-40"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={handleHeaderToggle}
                    disabled={pending}
                    aria-label="Selecionar todos os resultados da busca"
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batidas Atuais</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Limite Prev.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ativo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ tool, accumulated, status }) => (
                <tr key={tool.id} className={`hover:bg-gray-50 ${selected.has(tool.id) ? "bg-blue-50/50" : ""}`}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(tool.id)}
                      onChange={() => toggleRow(tool.id)}
                      aria-label={`Selecionar ${tool.code}`}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">{tool.code}</td>
                  <td className="px-6 py-4 text-gray-600">{tool.description ?? "—"}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(Math.round(accumulated))}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(tool.preventiveLimit)}</td>
                  <td className="px-6 py-4"><StatusBadge status={status} /></td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tool.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {tool.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <ToolActions tool={tool} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination}
      </div>
    </div>
  );
}
