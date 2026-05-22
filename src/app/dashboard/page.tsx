import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAllToolsProjection } from "@/lib/calculations/strokes";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const tools = await prisma.tool.findMany({
    where: { active: true },
    include: {
      bomItems: {
        include: {
          product: {
            include: { forecasts: true },
          },
        },
      },
    },
  });

  const maintenancesThisMonth = await prisma.maintenanceRecord.count({
    where: {
      maintenanceDate: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
  });

  return { tools, maintenancesThisMonth };
}

export default async function DashboardPage() {
  const { tools, maintenancesThisMonth } = await getDashboardData();
  const projections = getAllToolsProjection(tools);

  const counts = {
    total: projections.length,
    ok: projections.filter((p) => p.status === "OK").length,
    atencao: projections.filter((p) => p.status === "ATENCAO").length,
    programar: projections.filter((p) => p.status === "PROGRAMAR_PREVENTIVA").length,
    vencido: projections.filter((p) => p.status === "VENCIDO").length,
    erro: projections.filter((p) => p.status === "ERRO_CADASTRO").length,
  };

  const critical = projections
    .filter((p) => ["PROGRAMAR_PREVENTIVA", "VENCIDO", "ATENCAO"].includes(p.status))
    .sort((a, b) => b.totalProjectedStrokes - a.totalProjectedStrokes)
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral do controle de batidas de prensa"
        action={
          <Link href="/controle-50k" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Ver Controle 50K
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <SummaryCard title="Total de Ferramentais" value={counts.total} emoji="🔧" variant="info" />
        <SummaryCard title="OK" value={counts.ok} emoji="✅" variant="ok" />
        <SummaryCard title="Atenção" value={counts.atencao} emoji="⚡" variant="warning" />
        <SummaryCard title="Programar Preventiva" value={counts.programar} emoji="⚠️" variant="warning" />
        <SummaryCard title="Vencidos" value={counts.vencido} emoji="🚨" variant="danger" />
        <SummaryCard title="Manutenções no Mês" value={maintenancesThisMonth} emoji="🛠️" variant="default" />
      </div>

      {critical.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Ferramentais que Requerem Atenção</h2>
            <p className="text-sm text-gray-500 mt-1">Próximos de 50 mil batidas ou já vencidos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ferramental</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prensa</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batidas Atuais</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Projetado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo até 50k</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previsão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {critical.map((p) => (
                  <tr key={p.toolId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{p.code}</td>
                    <td className="px-6 py-4 text-gray-600">{p.press}</td>
                    <td className="px-6 py-4 text-right tabular-nums">{formatNumber(p.currentStrokes)}</td>
                    <td className="px-6 py-4 text-right tabular-nums font-medium">{formatNumber(p.totalProjectedStrokes)}</td>
                    <td className={`px-6 py-4 text-right tabular-nums font-medium ${p.remainingStrokes < 0 ? "text-red-600" : "text-gray-900"}`}>
                      {formatNumber(p.remainingStrokes)}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                    <td className="px-6 py-4 text-gray-600">{p.reachesLimitInMonth ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {critical.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <p className="text-4xl mb-2">✅</p>
          <h3 className="text-lg font-semibold text-green-800">Todos os ferramentais estão OK</h3>
          <p className="text-green-600 text-sm mt-1">Nenhum ferramental próximo do limite de 50 mil batidas.</p>
        </div>
      )}
    </div>
  );
}
