import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAllToolsProjection } from "@/lib/calculations/strokes";
import { formatNumber } from "@/lib/utils";
import { Controle50KFilters } from "./Controle50KFilters";
import { RegisterMaintenanceButton } from "./RegisterMaintenanceButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Controle50KPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; press?: string; search?: string }>;
}) {
  const params = await searchParams;

  const tools = await prisma.tool.findMany({
    where: {
      active: true,
      ...(params.press ? { press: params.press } : {}),
      ...(params.search ? { code: { contains: params.search, mode: "insensitive" } } : {}),
    },
    include: {
      bomItems: {
        include: {
          product: {
            include: { forecasts: true },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const allPresses = await prisma.tool.findMany({
    select: { press: true },
    distinct: ["press"],
    orderBy: { press: "asc" },
  });

  let projections = getAllToolsProjection(tools);

  if (params.status) {
    projections = projections.filter((p) => p.status === params.status);
  }

  const counts = {
    total: projections.length,
    ok: projections.filter((p) => p.status === "OK").length,
    atencao: projections.filter((p) => p.status === "ATENCAO").length,
    programar: projections.filter((p) => p.status === "PROGRAMAR_PREVENTIVA").length,
    vencido: projections.filter((p) => p.status === "VENCIDO").length,
  };

  return (
    <div>
      <PageHeader
        title="Controle 50K"
        description="Previsão de batidas e controle preventivo de ferramentais"
        action={
          <Link
            href="/manutencoes/nova"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            + Registrar Manutenção
          </Link>
        }
      />

      {/* Barra de resumo */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {[
          { label: "Total", count: counts.total, color: "bg-gray-100 text-gray-800" },
          { label: "OK", count: counts.ok, color: "bg-green-100 text-green-800" },
          { label: "Atenção", count: counts.atencao, color: "bg-yellow-100 text-yellow-800" },
          { label: "Programar Preventiva", count: counts.programar, color: "bg-orange-100 text-orange-800" },
          { label: "Vencidos", count: counts.vencido, color: "bg-red-100 text-red-800" },
        ].map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${item.color}`}
          >
            {item.label}: <strong>{item.count}</strong>
          </span>
        ))}
      </div>

      <Controle50KFilters presses={allPresses.map((p) => p.press)} />

      {projections.length === 0 ? (
        <EmptyState
          title="Nenhum ferramental encontrado"
          description="Ajuste os filtros ou cadastre ferramentais para visualizar as projeções."
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ferramental
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prensa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Linha
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Bat. Atuais
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Bat. Previstas
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total Projetado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Saldo até 50k
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Previsão de Atingir 50k
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projections.map((p) => (
                  <tr
                    key={p.toolId}
                    className={`hover:bg-gray-50 ${
                      p.status === "VENCIDO"
                        ? "bg-red-50"
                        : p.status === "PROGRAMAR_PREVENTIVA"
                        ? "bg-orange-50"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.code}</p>
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                      )}
                      {p.errors.length > 0 && (
                        <p className="text-xs text-red-600 mt-0.5">⚠ {p.errors[0]}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.press}</td>
                    <td className="px-4 py-3 text-gray-600">{p.line ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(p.currentStrokes)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(Math.round(p.forecastedStrokes))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatNumber(Math.round(p.totalProjectedStrokes))}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-semibold ${
                        p.remainingStrokes < 0
                          ? "text-red-600"
                          : p.remainingStrokes < 5000
                          ? "text-orange-600"
                          : "text-gray-900"
                      }`}
                    >
                      {formatNumber(Math.round(p.remainingStrokes))}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {p.reachesLimitInMonth ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(p.status === "PROGRAMAR_PREVENTIVA" || p.status === "VENCIDO") && (
                        <RegisterMaintenanceButton toolId={p.toolId} toolCode={p.code} />
                      )}
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
