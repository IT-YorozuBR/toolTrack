"use client";

import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="text-base font-semibold">Não foi possível carregar o dashboard</h2>
          <p className="mt-1 text-sm opacity-80">
            Tente novamente. Se o problema continuar, verifique a conexão com o banco e os dados
            usados nas projeções.
          </p>
          {error.digest && <p className="mt-2 text-xs opacity-70">Código: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
