import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getAllToolsProjection, getWindowDates } from "@/lib/calculations/strokes";
import { autoEnsureMonthlySnapshots } from "@/lib/actions/monthly-stroke-snapshots";
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

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export default async function Controle50KPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; press?: string; search?: string; page?: string; minStrokes?: string; reachesMonth?: string; simulatedate?: string; sort?: string; statusView?: string }>;
}) {
  const params = await searchParams;
  // Real é o padrão; só vai para estimado quando explicitamente pedido (?statusView=estimado).
  const isRealView = params.statusView !== "estimado";
  const minStrokes = params.minStrokes ? parseInt(params.minStrokes) : undefined;
  const referenceDate = params.simulatedate ? new Date(params.simulatedate) : undefined;

  void autoEnsureMonthlySnapshots(referenceDate);

  const toolInclude = {
    bomItems: {
      include: {
        product: {
          include: {
            forecasts: true,
            projectProducts: {
              include: {
                project: {
                  include: { forecasts: true },
                },
              },
            },
          },
        },
      },
    },
    maintenanceRecords: {
      where: { resetCounter: true },
      orderBy: { maintenanceDate: "desc" as const },
      take: 1,
    },
    monthlySnapshots: {
      orderBy: { referenceMonth: "asc" as const },
    },
    strokeReadings: {
      orderBy: { readingDate: "desc" as const },
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
    projections = projections.filter((p) => (isRealView ? p.realStatus : p.status) === params.status);
  }

  // Available months derived from filtered projections (before reachesMonth filter)
  const availableMonths = sortMonthLabels(
    [...new Set(projections.map((p) => p.reachesLimitInMonth).filter((m): m is string => !!m))]
  );

  if (params.reachesMonth) {
    projections = projections.filter((p) => p.reachesLimitInMonth === params.reachesMonth);
  }

  // Sem ordenação explícita, ordena pelo saldo da visão ativa (real por padrão).
  const sort = params.sort ?? (isRealView ? "real_asc" : "saldo_asc");
  // Ordena por saldo real mantendo ferramentas sem leitura (null) sempre no fim.
  const compareRealRemaining = (a: typeof projections[number], b: typeof projections[number], asc: boolean) => {
    const av = a.realRemainingStrokes;
    const bv = b.realRemainingStrokes;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return asc ? av - bv : bv - av;
  };
  projections = [...projections].sort((a, b) => {
    switch (sort) {
      case "saldo_desc":    return b.remainingStrokes - a.remainingStrokes;
      case "real_asc":      return compareRealRemaining(a, b, true);
      case "real_desc":     return compareRealRemaining(a, b, false);
      case "code_asc":      return a.code.localeCompare(b.code);
      case "code_desc":     return b.code.localeCompare(a.code);
      case "estimado_desc": return b.estimatedStrokes - a.estimatedStrokes;
      default:              return a.remainingStrokes - b.remainingStrokes; // saldo_asc
    }
  });

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
    if (params.sort) urlParams.set("sort", params.sort);
    if (params.statusView) urlParams.set("statusView", params.statusView);
    urlParams.set("page", String(p));
    return `/controle-50k?${urlParams.toString()}`;
  }

  // Alterna o cabeçalho Status entre estimado (forecast) e real (acúmulo real), preservando os demais filtros.
  function buildStatusViewUrl() {
    const urlParams = new URLSearchParams();
    if (params.status) urlParams.set("status", params.status);
    if (params.press) urlParams.set("press", params.press);
    if (params.search) urlParams.set("search", params.search);
    if (params.minStrokes) urlParams.set("minStrokes", params.minStrokes);
    if (params.reachesMonth) urlParams.set("reachesMonth", params.reachesMonth);
    if (params.simulatedate) urlParams.set("simulatedate", params.simulatedate);
    if (params.sort) urlParams.set("sort", params.sort);
    // Real é o padrão (sem param). Estando em real, o toggle leva para estimado; estando em estimado, volta ao padrão.
    if (isRealView) urlParams.set("statusView", "estimado");
    const qs = urlParams.toString();
    return `/controle-50k${qs ? `?${qs}` : ""}`;
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
            <table className="w-full table-fixed text-[11px] leading-tight">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-[18%] px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                    Ferramental
                  </th>
                  <th className="w-[8.5%] px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                    Últ. manut.
                  </th>
                  <th className="w-[8.5%] px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">
                    Batidas Estimadas Mensal
                  </th>
                  <th className="w-[8%] px-3 py-2 text-right text-[10px] font-medium text-blue-600 uppercase">
                    Acúmulo Real
                  </th>
                  <th className="w-[8%] px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">
                    Restante mês
                  </th>
                  {windowDates.map((w) => (
                    <th key={w.key} className="w-[6.25%] px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">
                      <div className={`${w.offset === 0 ? "text-blue-600" : ""}`}>{w.label}</div>
                      <div className="text-[10px] font-normal normal-case text-gray-400">{w.planningLabel}</div>
                    </th>
                  ))}
                  <th className="w-[8%] px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">
                    Projetado 4 Meses
                  </th>
                  <th className="w-[8%] px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">
                    Saldo 50k Estimado
                  </th>
                  <th className="w-[8%] px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">
                    Saldo 50k Atual
                  </th>
                  <th className="w-[8%] px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                    <a
                      href={buildStatusViewUrl()}
                      title={
                        isRealView
                          ? "Mostrando status real (acúmulo real). Clique para ver o status estimado."
                          : "Mostrando status estimado (forecast). Clique para ver o status real."
                      }
                      className={`inline-flex items-center gap-1 hover:text-gray-800 ${isRealView ? "text-blue-600" : ""}`}
                    >
                      Status {isRealView ? "Real" : "Estimado"}
                      <span className="text-gray-400">⇄</span>
                    </a>
                  </th>
                  <th className="w-[8%] px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                    Atinge
                  </th>
                  <th className="w-[8%] px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedProjections.map((p) => (
                  <tr
                    key={p.toolId}
                    className={`hover:bg-gray-50 ${
                      (isRealView ? p.realStatus : p.status) === "VENCIDO"
                        ? "bg-red-50"
                        : (isRealView ? p.realStatus : p.status) === "PROGRAMAR_PREVENTIVA"
                        ? "bg-orange-50"
                        : (isRealView ? p.realStatus : p.status) === "ATENCAO"
                        ? "bg-yellow-50"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{p.code}</p>
                      {p.description && (
                        <p className="mt-0.5 truncate text-[10px] text-gray-500" title={p.description}>
                          {p.description}
                        </p>
                      )}
                      {p.errors.length > 0 && (
                        <p className="mt-0.5 truncate text-[10px] text-red-600">⚠ {p.errors[0]}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-600">
                      {formatDate(p.lastMaintenanceDate)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span
                        className={
                          p.hasMaintenanceInReferenceMonth
                            ? "inline-flex min-w-14 justify-end rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-800 ring-1 ring-blue-200"
                            : ""
                        }
                        title={
                          p.hasMaintenanceInReferenceMonth
                            ? "Ferramental com manutenção registrada no mês de referência"
                            : undefined
                        }
                      >
                        {formatNumber(p.estimatedStrokes)}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        p.realEstimatedStrokes !== null ? "font-medium text-blue-600" : "text-gray-400"
                      }`}
                      title={
                        p.realEstimatedStrokes !== null && p.realCycleStrokes !== null
                          ? `${formatNumber(p.realCycleStrokes)} batidas registradas (leitura de ${formatDate(p.latestRealReadingDate)}) + ${formatNumber(Math.round(p.realEstimatedStrokes - p.realCycleStrokes))} estimadas pelos dias = ${formatNumber(Math.round(p.realEstimatedStrokes))}`
                          : "Sem leitura real registrada neste ciclo"
                      }
                    >
                      {p.realEstimatedStrokes !== null ? formatNumber(Math.round(p.realEstimatedStrokes)) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span
                        className={
                          p.hasMaintenanceInReferenceMonth
                            ? "inline-flex min-w-14 justify-end rounded bg-green-50 px-1.5 py-0.5 font-semibold text-green-800 ring-1 ring-green-200"
                            : "text-gray-700"
                        }
                        title={
                          p.hasMaintenanceInReferenceMonth
                            ? "Batidas que ainda faltam produzir no mês (previsão após a manutenção menos o já decorrido)"
                            : "Batidas que ainda faltam produzir no mês (previsão do mês menos o já decorrido até hoje)"
                        }
                      >
                        {formatNumber(p.currentMonthRemainingToDo)}
                      </span>
                    </td>
                    {p.window.map((m) => (
                      <td key={m.key} className={`px-3 py-2 text-right tabular-nums ${m.offset === 0 ? "font-medium text-blue-700" : "text-gray-700"}`}>
                        {m.strokes > 0 ? formatNumber(Math.round(m.strokes)) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatNumber(Math.round(p.totalProjectedStrokes))}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums font-semibold ${
                        p.remainingStrokes < 0
                          ? "text-red-600"
                          : p.remainingStrokes < 5000
                          ? "text-orange-600"
                          : "text-gray-900"
                      }`}
                    >
                      {formatNumber(Math.round(p.remainingStrokes))}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums font-semibold ${
                        p.realRemainingStrokes === null
                          ? "text-gray-400"
                          : p.realRemainingStrokes < 0
                          ? "text-red-600"
                          : p.realRemainingStrokes < 5000
                          ? "text-orange-600"
                          : "text-gray-900"
                      }`}
                    >
                      {p.realRemainingStrokes !== null ? formatNumber(Math.round(p.realRemainingStrokes)) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {isRealView ? (
                        p.realStatus ? (
                          <StatusBadge status={p.realStatus} />
                        ) : (
                          <span className="text-[10px] text-gray-400" title="Sem leitura real registrada neste ciclo">
                            sem leitura
                          </span>
                        )
                      ) : (
                        <StatusBadge status={p.status} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-600">
                      {p.reachesLimitInMonth ?? "—"}
                    </td>
                    <td className="px-3 py-2">
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
