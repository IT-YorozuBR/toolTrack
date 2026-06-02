"use client";

import { useState, useTransition } from "react";
import { getSnapshotHistory, updateSnapshotActualStrokes, type SnapshotHistoryRow } from "@/lib/actions/monthly-stroke-snapshots";
import { formatNumber } from "@/lib/utils";

const PT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatMonthKey(key: string) {
  const [y, m] = key.split("-");
  return `${PT_MONTHS[parseInt(m) - 1]}/${y}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

type Product = { id: string; code: string; description: string | null };

type EditMap = Record<string, string>; // snapshotId -> value string

export function HistoricoForm({ products }: { products: Product[] }) {
  const [fromMonth, setFromMonth] = useState(previousMonthKey);
  const [toMonth, setToMonth] = useState(previousMonthKey);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [rows, setRows] = useState<SnapshotHistoryRow[]>([]);
  const [edits, setEdits] = useState<EditMap>({});
  const [searched, setSearched] = useState(false);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const maxMonth = currentMonthKey();

  function toggleProduct(id: string) {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelectedProducts((prev) =>
      prev.length === products.length ? [] : products.map((p) => p.id)
    );
  }

  function handleSearch() {
    if (!selectedProducts.length) return;
    startSearch(async () => {
      const result = await getSnapshotHistory(fromMonth, toMonth, selectedProducts);
      setRows(result);
      setEdits({});
      setSearched(true);
      setSaveMessage(null);
    });
  }

  function handleSave() {
    const entries = Object.entries(edits).filter(([snapshotId]) => snapshotId !== "");
    if (!entries.length) return;
    startSave(async () => {
      for (const [snapshotId, raw] of entries) {
        const value = raw.trim() === "" ? null : parseInt(raw.replace(/\D/g, ""), 10);
        if (value !== null && isNaN(value)) continue;
        await updateSnapshotActualStrokes(snapshotId, value);
      }
      const updated = await getSnapshotHistory(fromMonth, toMonth, selectedProducts);
      setRows(updated);
      setEdits({});
      setSaveMessage(`${entries.length} registro(s) salvo(s).`);
    });
  }

  // Group rows by product then tool
  const grouped = rows.reduce<Record<string, Record<string, SnapshotHistoryRow[]>>>((acc, row) => {
    if (!acc[row.productId]) acc[row.productId] = {};
    const key = row.toolId;
    if (!acc[row.productId][key]) acc[row.productId][key] = [];
    acc[row.productId][key].push(row);
    return acc;
  }, {});

  const hasEdits = Object.keys(edits).length > 0;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Filtros</h2>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Mês inicial</label>
            <input
              type="month"
              value={fromMonth}
              max={maxMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Mês final</label>
            <input
              type="month"
              value={toMonth}
              max={maxMonth}
              onChange={(e) => setToMonth(e.target.value)}
              className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">Produtos</label>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-blue-600 hover:underline"
            >
              {selectedProducts.length === products.length ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProduct(p.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedProducts.includes(p.id)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                {p.code}
                {p.description ? ` — ${p.description}` : ""}
              </button>
            ))}
          </div>
          {!products.length && (
            <p className="text-xs text-gray-500">Nenhum produto cadastrado.</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !selectedProducts.length}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {searching ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {/* Resultados */}
      {searched && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">
              Nenhum dado encontrado para os filtros selecionados.
            </p>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Histórico de batidas</h2>
                <div className="flex items-center gap-3">
                  {saveMessage && (
                    <span className="text-xs text-green-700 font-medium">{saveMessage}</span>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !hasEdits}
                    className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {Object.entries(grouped).map(([productId, toolGroups]) => {
                  const productCode = rows.find((r) => r.productId === productId)?.productCode ?? productId;
                  return (
                    <div key={productId}>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Produto: {productCode}
                        </span>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50/60">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ferramental</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estimado</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Real</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fonte</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Object.entries(toolGroups).flatMap(([, toolRows]) =>
                            toolRows.map((row, i) => {
                              const editKey = row.snapshotId ?? "";
                              const editValue = edits[editKey];
                              const displayValue =
                                editValue !== undefined
                                  ? editValue
                                  : row.actualStrokes !== null
                                  ? String(row.actualStrokes)
                                  : "";
                              const isEdited = editValue !== undefined;
                              const noSnapshot = row.snapshotId === null;

                              return (
                                <tr
                                  key={`${row.toolId}-${row.referenceMonth}`}
                                  className={isEdited ? "bg-yellow-50" : ""}
                                >
                                  <td className="px-4 py-2 font-medium text-gray-900">
                                    {i === 0 ? row.toolCode : ""}
                                    {i === 0 && row.toolDescription ? (
                                      <span className="ml-1 font-normal text-gray-500 text-xs">
                                        {row.toolDescription}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-2 text-gray-700">{formatMonthKey(row.referenceMonth)}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                                    {noSnapshot ? (
                                      <span className="text-gray-400 italic text-xs">sem snapshot</span>
                                    ) : (
                                      formatNumber(row.estimatedStrokes)
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {noSnapshot ? (
                                      <span className="text-gray-400 italic text-xs">—</span>
                                    ) : (
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="—"
                                        value={displayValue}
                                        onChange={(e) =>
                                          setEdits((prev) => ({
                                            ...prev,
                                            [editKey]: e.target.value,
                                          }))
                                        }
                                        className="w-28 rounded border border-gray-300 px-2 py-0.5 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    {noSnapshot ? (
                                      <span className="text-xs text-orange-600 font-medium">sem snapshot</span>
                                    ) : row.source.startsWith("auto") ? (
                                      <span className="text-xs text-gray-500">Auto</span>
                                    ) : row.source.includes("forecast") ? (
                                      <span className="text-xs text-gray-500">Fechamento</span>
                                    ) : (
                                      <span className="text-xs text-blue-600 font-medium">Manual</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              {hasEdits && (
                <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
