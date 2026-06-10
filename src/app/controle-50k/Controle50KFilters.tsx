"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  presses: string[];
  availableMonths: string[];
}

export function Controle50KFilters({ presses, availableMonths }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.push(`/controle-50k?${params.toString()}`);
    },
    [router, searchParams]
  );

  const simulateDate = searchParams.get("simulateDate") ?? "";

  // Formata uma data como YYYY-MM-DD no fuso local (sem deslocamento de UTC).
  const toInputValue = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Salta N meses a partir da data simulada atual (ou de hoje, se nenhuma).
  const jumpMonths = (months: number) => {
    const base = simulateDate ? new Date(`${simulateDate}T12:00:00`) : new Date();
    base.setMonth(base.getMonth() + months);
    updateFilter("simulateDate", toInputValue(base));
  };

  return (
    <div className="flex gap-3 flex-wrap items-center">
      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Todos os status</option>
        <option value="OK">OK</option>
        <option value="ATENCAO">Atenção</option>
        <option value="PROGRAMAR_PREVENTIVA">Programar Preventiva</option>
        <option value="VENCIDO">Vencido</option>
        <option value="ERRO_CADASTRO">Erro de Cadastro</option>
      </select>

      {/* <select
        value={searchParams.get("press") ?? ""}
        onChange={(e) => updateFilter("press", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Todas as prensas</option>
        {presses.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select> */}

      <select
        value={searchParams.get("reachesMonth") ?? ""}
        onChange={(e) => updateFilter("reachesMonth", e.target.value)}
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
          value={searchParams.get("reachesFrom") ?? ""}
          onChange={(e) => updateFilter("reachesFrom", e.target.value)}
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
          value={searchParams.get("reachesTo") ?? ""}
          onChange={(e) => updateFilter("reachesTo", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">fim</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 whitespace-nowrap">Batidas ≥</span>
        <input
          type="number"
          min="0"
          step="1000"
          placeholder="Ex: 40000"
          defaultValue={searchParams.get("minStrokes") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateFilter("minStrokes", (e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => updateFilter("minStrokes", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
        />
      </div> */}

      <input
        type="text"
        placeholder="Buscar ferramental..."
        defaultValue={searchParams.get("search") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") updateFilter("search", (e.target as HTMLInputElement).value);
        }}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
      />

      <select
        value={searchParams.get("saldoSign") ?? ""}
        onChange={(e) => updateFilter("saldoSign", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        title="Como exibir o Saldo 50k quando o ferramental ultrapassa o limite"
      >
        <option value="">Saldo restante (limite − uso)</option>
        <option value="excedente">Saldo excedente (uso − limite)</option>
      </select>

      <select
        value={searchParams.get("sort") ?? (searchParams.get("statusView") !== "estimado" ? "real_asc" : "saldo_asc")}
        onChange={(e) => updateFilter("sort", e.target.value)}
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
          onChange={(e) => updateFilter("simulateDate", e.target.value)}
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
            onClick={() => updateFilter("simulateDate", "")}
            className="rounded-md px-1.5 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
            title="Voltar para hoje"
            aria-label="Limpar data simulada"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
