"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

// Filtros da tela que devem viajar junto na exportação.
const TABLE_FILTERS = [
  "press",
  "status",
  "search",
  "minStrokes",
  "reachesMonth",
  "reachesFrom",
  "reachesTo",
  "simulateDate",
  "statusView",
  "saldoSign",
] as const;

export function ExportButton() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [from, setFrom] = useState(isoDate(new Date(now.getFullYear(), now.getMonth() - 12, 1)));
  const [to, setTo] = useState(isoDate(new Date(now.getFullYear(), now.getMonth() + 12, 1)));

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleDownload() {
    const params = new URLSearchParams();
    for (const key of TABLE_FILTERS) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    params.set("from", from);
    params.set("to", to);
    window.location.href = `/api/relatorios/50k?${params.toString()}`;
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
      >
        Exportar Excel
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          <p className="mb-3 text-xs text-gray-500">
            Período do histórico de manutenções e da projeção de demanda. As abas de Status e
            Preventivas seguem os filtros atuais da tela.
          </p>
          <label className="mb-1 block text-xs font-medium text-gray-600">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <label className="mb-1 block text-xs font-medium text-gray-600">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleDownload}
            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Baixar .xlsx
          </button>
        </div>
      )}
    </div>
  );
}
