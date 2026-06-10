import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { DeleteMaintenanceButton } from "./DeleteMaintenanceButton";

type MaintenanceRecord = {
  id: string;
  maintenanceDate: Date;
  strokesAtMaintenance: number;
  maintenanceType: string;
  responsible: string | null;
  resetCounter: boolean;
  notes: string | null;
};

type Tool = {
  id: string;
  code: string;
  description: string | null;
  press: string;
  line: string | null;
  maintenanceRecords: MaintenanceRecord[];
};

function TypeBadge({ type }: { type: string }) {
  const color =
    type === "Preventiva"
      ? "bg-green-100 text-green-800"
      : type === "Corretiva"
      ? "bg-red-100 text-red-800"
      : "bg-blue-100 text-blue-800";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {type}
    </span>
  );
}

export function MaintenanceList({ tool, backUrl }: { tool: Tool; backUrl: string }) {
  const records = tool.maintenanceRecords;

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <a href={backUrl} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            ← Voltar
          </a>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{tool.code}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {[tool.description, tool.press, tool.line].filter(Boolean).join(" — ")}
            </p>
          </div>
        </div>
        <Link
          href={`/manutencoes/nova?toolId=${tool.id}`}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 shrink-0"
        >
          + Registrar Manutenção
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm mb-3">Nenhuma manutenção registrada para este ferramental.</p>
          <Link
            href={`/manutencoes/nova?toolId=${tool.id}`}
            className="text-orange-600 text-sm hover:underline"
          >
            + Registrar a primeira manutenção
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {records.length} {records.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batidas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsável</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contador</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observação</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-700">
                      {new Date(r.maintenanceDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-gray-700">
                      {formatNumber(r.strokesAtMaintenance)}
                    </td>
                    <td className="px-6 py-4">
                      <TypeBadge type={r.maintenanceType} />
                    </td>
                    <td className="px-6 py-4 text-gray-600">{r.responsible ?? "—"}</td>
                    <td className="px-6 py-4">
                      {r.resetCounter ? (
                        <span className="text-green-600 text-xs font-medium">✓ Zerado</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={r.notes ?? undefined}>
                      {r.notes ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {idx === 0 ? (
                        <DeleteMaintenanceButton id={r.id} />
                      ) : (
                        <span
                          className="text-xs text-gray-300"
                          title="Só é possível excluir a manutenção mais recente do ferramental."
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
