"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2, X } from "lucide-react";

export function DashboardFilters({
  presses,
  lines,
  applied,
}: {
  presses: string[];
  lines: string[];
  applied: { press?: string; line?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const hasFilter = Boolean(applied.press || applied.line);

  function updateParam(key: "press" | "line", value: string) {
    const params = new URLSearchParams();
    const next = { ...applied, [key]: value || undefined };
    if (next.press) params.set("press", next.press);
    if (next.line) params.set("line", next.line);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/dashboard?${query}` : "/dashboard");
    });
  }

  function clear() {
    startTransition(() => {
      router.push("/dashboard");
    });
  }

  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Filter className="h-4 w-4" />
        Filtrar
      </span>

      <select
        aria-label="Filtrar por prensa"
        className={selectClass}
        value={applied.press ?? ""}
        onChange={(event) => updateParam("press", event.target.value)}
      >
        <option value="">Todas as prensas</option>
        {presses.map((press) => (
          <option key={press} value={press}>
            {press}
          </option>
        ))}
      </select>

      {lines.length > 0 && (
        <select
          aria-label="Filtrar por linha"
          className={selectClass}
          value={applied.line ?? ""}
          onChange={(event) => updateParam("line", event.target.value)}
        >
          <option value="">Todas as linhas</option>
          {lines.map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </select>
      )}

      {hasFilter && (
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </button>
      )}

      {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
    </div>
  );
}
