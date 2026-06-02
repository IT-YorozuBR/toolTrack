"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { closePreviousMonthToolStrokeSnapshotsFromForm } from "@/lib/actions/monthly-stroke-snapshots";
import { formatNumber } from "@/lib/utils";

type ActionState = Awaited<ReturnType<typeof closePreviousMonthToolStrokeSnapshotsFromForm>> | null;

function SubmitCloseButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Fechando..." : "Fechar mês anterior"}
    </button>
  );
}

export function CloseMonthForm() {
  const [state, formAction] = useActionState(closePreviousMonthToolStrokeSnapshotsFromForm, null as ActionState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input name="overwrite" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>
              <strong className="block text-gray-900">Sobrescrever mês já fechado</strong>
              Use apenas quando precisar recalcular snapshots com previsões ou manutenções corrigidas.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input name="includeInactive" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>
              <strong className="block text-gray-900">Incluir ferramentais inativos</strong>
              Mantém histórico completo, mas aumenta o volume processado.
            </span>
          </label>
        </div>

        <SubmitCloseButton />
      </form>

      {state?.success === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Fechamento {state.referenceMonth}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Criados: {state.created} | Atualizados: {state.updated} | Ignorados: {state.skipped}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ferramental</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Mês cheio</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aplicado ciclo</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Atual</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {state.tools.slice(0, 50).map((tool) => (
                  <tr key={tool.toolId}>
                    <td className="px-4 py-2 font-medium text-gray-900">{tool.code}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(tool.strokes)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(tool.appliedStrokes)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(tool.currentStrokes)}</td>
                    <td className="px-4 py-2 text-gray-600">{tool.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.tools.length > 50 && (
            <p className="px-4 py-3 text-xs text-gray-500">Mostrando 50 de {state.tools.length} ferramentais processados.</p>
          )}
        </div>
      )}
    </div>
  );
}
