import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getAllToolsProjection, getWindowDates } from "@/lib/calculations/strokes";
import { formatNumber } from "@/lib/utils";
import { Controle50KFilters } from "./Controle50KFilters";
import { RegisterMaintenanceButton } from "./RegisterMaintenanceButton";
import Link from "next/link";

const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

const PT_MONTH_IDX: Record<string, number> = {
  Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5,
  Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11,
};

function sortMonthLabels(labels: string[]): string[] {
  return labels.sort((a, b) => {
    const [ma, ya] = a.split("/");
    const [mb, yb] = b.split("/");
    const da = parseInt(ya) * 12 + (PT_MONTH_IDX[ma] ?? 0);
    const db = parseInt(yb) * 12 + (PT_MONTH_IDX[mb] ?? 0);
    return da - db;
  });
}

export default async function Controle50KPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; press?: string; search?: string; page?: string; minStrokes?: string; reachesMonth?: string; simulatedate?: string }>;
}) {
  const params = await searchParams;
  const minStrokes = params.minStrokes ? parseInt(params.minStrokes) : undefined;
  const referenceDate = params.simulatedate ? new Date(params.simulatedate) : undefined;

  const toolInclude = {
    bomItems: {
      include: {
        product: {
          include: { forecasts: true },
        },
      },
    },
    maintenanceRecords: {
      where: { resetCounter: true },
      orderBy: { maintenanceDate: "desc" as const },
      take: 1,
    },
  } as const;

  const [tools, allActiveTools, allPresses] = await Promise.all([
    prisma.tool.findMany({
      where: {
        active: true,
        ...(params.press ? { press: params.press } : {}),
        ...(params.search ? { code: { contains: params.search, mode: "insensitive" } } : {}),
        ...(minStrokes ? { currentStrokes: { gte: minStrokes } } : {}),
      },
      include: toolInclude,
      orderBy: { code: "asc" },
    }),
    prisma.tool.findMany({
      where: { active: true },
      include: toolInclude,
      orderBy: { code: "asc" },
    }),
    prisma.tool.findMany({
      select: { press: true },
      distinct: ["press"],
      orderBy: { press: "asc" },
    }),
  ]);

  const windowDates = getWindowDates(referenceDate);

  // Counts are always global — all active tools, no filters
  const allProjections = getAllToolsProjection(allActiveTools, referenceDate);
  const counts = {
    total: allProjections.length,
    ok: allProjections.filter((p) => p.status === "OK").length,
    atencao: allProjections.filter((p) => p.status === "ATENCAO").length,
    programar: allProjections.filter((p) => p.status === "PROGRAMAR_PREVENTIVA").length,
    vencido: allProjections.filter((p) => p.status === "VENCIDO").length,
  };

  // Filtered projections for the table
  let projections = getAllToolsProjection(tools, referenceDate);

  if (params.status) {
    projections = projections.filter((p) => p.status === params.status);
  }

  // Available months derived from filtered projections (before reachesMonth filter)
  const availableMonths = sortMonthLabels(
    [...new Set(projections.map((p) => p.reachesLimitInMonth).filter((m): m is string => !!m))]
  );

  if (params.reachesMonth) {
    projections = projections.filter((p) => p.reachesLimitInMonth === params.reachesMonth);
  }

  const currentPage = Math.max(1, parseInt(params.page ?? "1"));
  const totalPages = Math.ceil(projections.length / PAGE_SIZE);
  const paginatedProjections = projections.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function buildPageUrl(p: number) {
    const urlParams = new URLSearchParams();
    if (params.status) urlParams.set("status", params.status);
    if (params.press) urlParams.set("press", params.press);
    if (params.search) urlParams.set("search", params.search);
    if (params.minStrokes) urlParams.set("minStrokes", params.minStrokes);
    if (params.reachesMonth) urlParams.set("reachesMonth", params.reachesMonth);
    if (params.simulatedate) urlParams.set("simulatedate", params.simulatedate);
    urlParams.set("page", String(p));
    return `/controle-50k?${urlParams.toString()}`;
  }

  return (
    <div>
      {referenceDate && (
        <div className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
          Simulando data: <strong>{referenceDate.toLocaleDateString("pt-BR")}</strong> —{" "}
          <a href="/controle-50k" className="underline">voltar para hoje</a>
        </div>
      )}
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

      <Controle50KFilters presses={allPresses.map((p) => p.press)} availableMonths={availableMonths} />

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
                    Bat. Estimadas
                  </th>
                  {windowDates.map((w) => (
                    <th key={w.key} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      <div className={`${w.offset === 0 ? "text-blue-600" : ""}`}>{w.label}</div>
                      <div className="text-[10px] font-normal normal-case text-gray-400">{w.planningLabel}</div>
                    </th>
                  ))}
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
                {paginatedProjections.map((p) => (
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
                      {formatNumber(p.estimatedStrokes)}
                    </td>
                    {p.window.map((m) => (
                      <td key={m.key} className={`px-4 py-3 text-right tabular-nums text-xs ${m.offset === 0 ? "text-blue-700 font-medium" : "text-gray-700"}`}>
                        {m.strokes > 0 ? formatNumber(Math.round(m.strokes)) : "—"}
                      </td>
                    ))}
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
          <Pagination currentPage={currentPage} totalPages={totalPages} buildPageUrl={buildPageUrl} />
        </div>
      )}
    </div>
  );
}
