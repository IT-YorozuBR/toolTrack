"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Props {
  presses: string[];
  availableMonths: string[];
}

// Chaves de filtro geridas por esta barra. statusView fica de fora de propósito:
// é uma preferência de visão alternada pelo cabeçalho da tabela, não um filtro.
const FILTER_KEYS = [
  "status",
  "reachesMonth",
  "reachesFrom",
  "reachesTo",
  "search",
  "saldoSign",
  "sort",
  "simulateDate",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];
type FilterState = Record<FilterKey, string>;

function readFilters(searchParams: URLSearchParams): FilterState {
  return Object.fromEntries(
    FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? ""])
  ) as FilterState;
}

export function Controle50KFilters({ presses, availableMonths }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estado local: os filtros não são aplicados a cada mudança, só ao clicar em Pesquisar.
  const [filters, setFilters] = useState<FilterState>(() => readFilters(searchParams));

  // Mantém o estado local em sincronia quando a URL muda por fora desta barra
  // (paginação, alternância de visão no cabeçalho, ou após aplicar/limpar).
  useEffect(() => {
    setFilters(readFilters(searchParams));
  }, [searchParams]);

  const setField = useCallback((key: FilterKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      if (filters[key]) params.set(key, filters[key]);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`/controle-50k?${params.toString()}`);
  }, [filters, router, searchParams]);

  const clearFilters = useCallback(() => {
    // Preserva statusView (preferência de visão); zera tudo o mais.
    const params = new URLSearchParams();
    const statusView = searchParams.get("statusView");
    if (statusView) params.set("statusView", statusView);
    const qs = params.toString();
    router.push(`/controle-50k${qs ? `?${qs}` : ""}`);
  }, [router, searchParams]);

  const simulateDate = filters.simulateDate;

  // Indica se há algo a limpar (algum filtro local ou já aplicado na URL).
  const hasActiveFilters =
    FILTER_KEYS.some((k) => filters[k]) ||
    FILTER_KEYS.some((k) => searchParams.get(k));

  // Formata uma data como YYYY-MM-DD no fuso local (sem deslocamento de UTC).
  const toInputValue = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Salta N meses a partir da data simulada atual (ou de hoje, se nenhuma).
  const jumpMonths = (months: number) => {
    const base = simulateDate ? new Date(`${simulateDate}T12:00:00`) : new Date();
    base.setMonth(base.getMonth() + months);
    setField("simulateDate", toInputValue(base));
  };

  return (
    <div className="flex gap-3 flex-wrap items-center">
      <select
        value={filters.status}
        onChange={(e) => setField("status", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Todos os status</option>
        <option value="OK">BOSTA BOSTA</option>
        <option value="ATENCAO">Atenção</option>
        <option value="PROGRAMAR_PREVENTIVA">Programar Preventiva</option>
        <option value="VENCIDO">Vencido</option>
        <option value="ERRO_CADASTRO">Erro de Cadastro</option>
      </select>

      <select
        value={filters.reachesMonth}
        onChange={(e) => setField("reachesMonth", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Manutenção em qualquer mês</option>
        {availableMonths.map((m) => (
          <option key={m} value={m}>Atinge limite em {m}</option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 whitespace-nowrap">Atinge entre</span>
        <select
          aria-label="Atinge limite a partir de"
          value={filters.reachesFrom}
          onChange={(e) => setField("reachesFrom", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">início</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">e</span>
        <select
          aria-label="Atinge limite até"
          value={filters.reachesTo}
          onChange={(e) => setField("reachesTo", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">fim</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <input
        type="text"
        placeholder="Buscar ferramental..."
        value={filters.search}
        onChange={(e) => setField("search", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") applyFilters();
        }}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
      />

      <select
        value={filters.saldoSign}
        onChange={(e) => setField("saldoSign", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        title="Como exibir o Saldo 50k quando o ferramental ultrapassa o limite"
      >
        <option value="">Saldo restante (limite − uso)</option>
        <option value="excedente">Saldo excedente (uso − limite)</option>
      </select>

      <select
        value={filters.sort || (searchParams.get("statusView") !== "estimado" ? "real_asc" : "saldo_asc")}
        onChange={(e) => setField("sort", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <optgroup label="Saldo 50k Estimado">
          <option value="saldo_asc">Estimado ↑ (menor primeiro)</option>
          <option value="saldo_desc">Estimado ↓ (maior primeiro)</option>
        </optgroup>
        <optgroup label="Saldo 50k Real">
          <option value="real_asc">Real ↑ (menor primeiro)</option>
          <option value="real_desc">Real ↓ (maior primeiro)</option>
        </optgroup>
        <optgroup label="Ferramental">
          <option value="code_asc">Ferramental A→Z</option>
          <option value="code_desc">Ferramental Z→A</option>
        </optgroup>
        <optgroup label="Atinge limite (50k)">
          <option value="atinge_asc">Atinge 50k mais cedo (manutenção antes)</option>
          <option value="atinge_desc">Atinge 50k mais tarde</option>
        </optgroup>
      </select>

      <div
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
          simulateDate ? "border-yellow-400 bg-yellow-50" : "border-gray-300 bg-white"
        }`}
        title="Simula a projeção como se hoje fosse a data escolhida"
      >
        <span className="text-sm text-gray-500 whitespace-nowrap pl-1">Simular data</span>
        <input
          type="date"
          value={simulateDate}
          onChange={(e) => setField("simulateDate", e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button
          type="button"
          onClick={() => jumpMonths(1)}
          className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          +1m
        </button>
        <button
          type="button"
          onClick={() => jumpMonths(3)}
          className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          +3m
        </button>
        <button
          type="button"
          onClick={() => jumpMonths(6)}
          className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          +6m
        </button>
        {simulateDate && (
          <button
            type="button"
            onClick={() => setField("simulateDate", "")}
            className="rounded-md px-1.5 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
            title="Voltar para hoje"
            aria-label="Limpar data simulada"
          >
            ✕
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={applyFilters}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        Pesquisar
      </button>

      <button
        type="button"
        onClick={clearFilters}
        disabled={!hasActiveFilters}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Limpar filtros
      </button>
    </div>
  );
}
