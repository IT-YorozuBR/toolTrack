"use client";
import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProductionForecast } from "@/lib/actions/forecasts";

export type WindowCol = {
  key: string;
  label: string;
  offset: number;
  date: string; // ISO "YYYY-MM-DD" — passed from server to avoid timezone issues
  isCurrent?: boolean;
};

export type ForecastCell = {
  id: string | null;
  plannedQuantity: number | null;
};

export type VolumeRow = {
  productId: string;
  code: string;
  modelo: string | null;
  cells: Record<string, ForecastCell>; // monthKey → cell
};

interface Props {
  rows: VolumeRow[];
  cols: WindowCol[];
}

type EditingCell = { productId: string; monthKey: string; initial: string };

export function VolumeGrid({ rows, cols }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  function cellKey(productId: string, monthKey: string) {
    return `${productId}_${monthKey}`;
  }

  function startEdit(productId: string, monthKey: string, current: number | null) {
    setEditing({ productId, monthKey, initial: current ? String(current) : "" });
    setInputValue(current ? String(current) : "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(null);
    setInputValue("");
  }

  async function commitEdit() {
    if (!editing) return;
    const qty = parseInt(inputValue) || 0;
    const col = cols.find((c) => c.key === editing.monthKey);
    if (!col) return;

    const [year, month] = col.date.split("-").map(Number);
    const key = cellKey(editing.productId, editing.monthKey);

    setEditing(null);
    setSaving((s) => new Set(s).add(key));

    await upsertProductionForecast({
      productId: editing.productId,
      referenceMonth: new Date(Date.UTC(year, month - 1, 1, 12)),
      plannedQuantity: qty,
    });

    setSaving((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    startTransition(() => router.refresh());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") cancelEdit();
  }

  const colHeaderStyle = (offset: number) =>
    offset === 0
      ? "text-blue-600 font-semibold"  // N-1 = mês atual
      : "text-gray-600";

  const planningLabels = ["N-1", "N", "N+1", "N+2"];

  const colLabel = (col: WindowCol) => (
    <div className="text-center">
      <div className={`text-xs font-medium uppercase ${colHeaderStyle(col.offset)}`}>
        {col.label}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">{planningLabels[col.offset]}</div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Produto
              </th>
              {cols.map((col) => (
                <th key={col.key} className="px-5 py-3 text-center w-36">
                  {colLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.productId} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{row.code}</p>
                  {row.modelo && <p className="text-xs text-gray-400">{row.modelo}</p>}
                </td>
                {cols.map((col) => {
                  const cell = row.cells[col.key] ?? { id: null, plannedQuantity: null };
                  const key = cellKey(row.productId, col.key);
                  const isEditing = editing?.productId === row.productId && editing.monthKey === col.key;
                  const isSaving = saving.has(key);

                  return (
                    <td key={col.key} className="px-2 py-2 text-center">
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="number"
                          min="0"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          className="w-full text-center border border-blue-400 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                          placeholder="0"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(row.productId, col.key, cell.plannedQuantity)}
                          disabled={isSaving}
                          className={`w-full rounded-md px-3 py-1.5 text-sm tabular-nums transition-colors
                            ${isSaving ? "opacity-50 cursor-wait" : "cursor-pointer hover:bg-blue-50 hover:text-blue-700"}
                            ${cell.plannedQuantity ? "text-gray-900 font-medium" : "text-gray-300"}
                            ${col.offset === 0 ? "bg-blue-50/40" : ""}
                          `}
                        >
                          {isSaving ? (
                            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          ) : cell.plannedQuantity ? (
                            cell.plannedQuantity.toLocaleString("pt-BR")
                          ) : (
                            "—"
                          )}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
