"use client";
import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProjectForecast } from "@/lib/actions/project-forecasts";
import type { WindowCol } from "./VolumeGrid";

export type ProjectVolumeRow = {
  projectId: string;
  name: string;
  cells: Record<string, { id: string | null; plannedQuantity: number | null }>;
};

interface Props {
  rows: ProjectVolumeRow[];
  cols: WindowCol[];
}

type EditingCell = { projectId: string; monthKey: string };

export function ProjectVolumeGrid({ rows, cols }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Drag-to-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ pending: false, dragging: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { pending: true, dragging: false, startX: e.pageX, scrollLeft: el.scrollLeft };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el || !drag.current.pending) return;
    const delta = e.pageX - drag.current.startX;
    if (!drag.current.dragging && Math.abs(delta) < 5) return;
    drag.current.dragging = true;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
    el.scrollLeft = drag.current.scrollLeft - delta;
  }, []);

  const onMouseUp = useCallback(() => {
    drag.current.pending = false;
    drag.current.dragging = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = "grab";
      scrollRef.current.style.userSelect = "";
    }
  }, []);

  function cellKey(projectId: string, monthKey: string) {
    return `${projectId}_${monthKey}`;
  }

  function startEdit(projectId: string, monthKey: string, current: number | null) {
    setEditing({ projectId, monthKey });
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
    const key = cellKey(editing.projectId, editing.monthKey);

    setEditing(null);
    setSaving((s) => new Set(s).add(key));

    await upsertProjectForecast({
      projectId: editing.projectId,
      referenceMonth: new Date(year, month - 1, 1),
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

  const colLabel = (col: WindowCol) => (
    <div className="text-center">
      <div className={`text-xs font-medium uppercase ${col.isCurrent ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
        {col.label}
      </div>
      {col.isCurrent && <div className="text-[10px] text-blue-400 mt-0.5">atual</div>}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div
        ref={scrollRef}
        className="overflow-x-auto cursor-grab"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projeto</th>
              {cols.map((col) => (
                <th key={col.key} className="px-5 py-3 text-center w-36">
                  {colLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.projectId} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{row.name}</p>
                </td>
                {cols.map((col) => {
                  const cell = row.cells[col.key] ?? { id: null, plannedQuantity: null };
                  const key = cellKey(row.projectId, col.key);
                  const isEditing = editing?.projectId === row.projectId && editing.monthKey === col.key;
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
                          onClick={() => startEdit(row.projectId, col.key, cell.plannedQuantity)}
                          disabled={isSaving}
                          className={`w-full rounded-md px-3 py-1.5 text-sm tabular-nums transition-colors
                            ${isSaving ? "opacity-50 cursor-wait" : "cursor-pointer hover:bg-blue-50 hover:text-blue-700"}
                            ${cell.plannedQuantity ? "text-gray-900 font-medium" : "text-gray-300"}
                            ${col.isCurrent ? "bg-blue-50/40" : ""}
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
