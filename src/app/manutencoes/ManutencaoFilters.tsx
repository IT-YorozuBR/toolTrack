"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  presses: string[];
  types: string[];
}

export function ManutencaoFilters({ presses, types }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.push(`/manutencoes?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="flex gap-3 flex-wrap items-center">
      <select
        value={searchParams.get("press") ?? ""}
        onChange={(e) => updateFilter("press", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Todas as prensas</option>
        {presses.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select
        value={searchParams.get("type") ?? ""}
        onChange={(e) => updateFilter("type", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Todos os tipos</option>
        {types.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Buscar ferramental..."
        defaultValue={searchParams.get("search") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") updateFilter("search", (e.target as HTMLInputElement).value);
        }}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
      />

      {(searchParams.get("search") || searchParams.get("press") || searchParams.get("type")) && (
        <button
          type="button"
          onClick={() => router.push("/manutencoes")}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
