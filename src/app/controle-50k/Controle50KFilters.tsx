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
    </div>
  );
}
