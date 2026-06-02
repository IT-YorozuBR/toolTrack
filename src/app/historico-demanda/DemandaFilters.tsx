"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  presses: string[];
}

export function DemandaFilters({ presses }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.push(`/historico-demanda?${params.toString()}`);
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
        value={searchParams.get("months") ?? "6"}
        onChange={(e) => updateFilter("months", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="3">Últimos 3 meses</option>
        <option value="6">Últimos 6 meses</option>
        <option value="12">Últimos 12 meses</option>
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
    </div>
  );
}
