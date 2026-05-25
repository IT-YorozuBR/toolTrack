import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ManutencoesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const searchTerm = search?.trim() ?? "";

  const [records, total] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      where: searchTerm
        ? { tool: { code: { contains: searchTerm, mode: "insensitive" } } }
        : undefined,
      include: { tool: true },
      orderBy: { maintenanceDate: "desc" },
    }),
    prisma.maintenanceRecord.count({
      where: searchTerm
        ? { tool: { code: { contains: searchTerm, mode: "insensitive" } } }
        : undefined,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Manutenções"
        description="Histórico completo de manutenções realizadas"
        action={
          <Link
            href="/manutencoes/nova"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            + Registrar Manutenção
          </Link>
        }
      />

      <SearchInput
        basePath="/manutencoes"
        initialValue={searchTerm}
        placeholder="Buscar por código do ferramental…"
        total={total}
        label={total === 1 ? "registro" : "registros"}
      />

      {records.length === 0 ? (
        <EmptyState
          title={searchTerm ? "Nenhuma manutenção encontrada" : "Nenhuma manutenção registrada"}
          description={searchTerm ? `Nenhum resultado para "${searchTerm}".` : "Registre manutenções para manter o histórico do ferramental."}
          action={
            !searchTerm ? (
              <Link
                href="/manutencoes/nova"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
              >
                Registrar Manutenção
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ferramental
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Batidas no Momento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Responsável
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contador Zerado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Observação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{r.tool.code}</p>
                      {r.tool.description && (
                        <p className="text-xs text-gray-500">{r.tool.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {new Date(r.maintenanceDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {formatNumber(r.strokesAtMaintenance)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.maintenanceType === "Preventiva"
                            ? "bg-green-100 text-green-800"
                            : r.maintenanceType === "Corretiva"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {r.maintenanceType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{r.responsible ?? "—"}</td>
                    <td className="px-6 py-4">
                      {r.resetCounter ? (
                        <span className="text-green-600 text-xs font-medium">✓ Zerado</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                      {r.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
