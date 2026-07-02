"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAllIgnoreManualReadings } from "@/lib/actions/stroke-readings";

export function BulkIgnoreReadingsToggle({
  ignoredCount,
  total,
}: {
  ignoredCount: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Ligado = todos os ferramentais ativos estão desconsiderando leituras.
  const allIgnored = total > 0 && ignoredCount === total;
  const someIgnored = ignoredCount > 0 && ignoredCount < total;

  function apply(ignore: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setAllIgnoreManualReadings(ignore);
      if (!result.success) {
        setError(result.error ?? "Erro desconhecido.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">
            Desconsiderar leituras manuais de todos os ferramentais
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {allIgnored
              ? "Todos os ferramentais estão ignorando as leituras manuais no Controle 50K. Os dados continuam salvos."
              : someIgnored
              ? `${ignoredCount} de ${total} ferramentais estão ignorando as leituras manuais. Use os botões para aplicar a todos.`
              : "Aplica a todos os ferramentais de uma vez. Os dados das leituras não são excluídos — apenas ignorados na projeção."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => apply(true)}
            disabled={pending || allIgnored}
            className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
          >
            {pending ? "..." : "Desconsiderar todos"}
          </button>
          <button
            type="button"
            onClick={() => apply(false)}
            disabled={pending || ignoredCount === 0}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            {pending ? "..." : "Reativar todos"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
