import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getAllToolsProjection, getWindowDates, type ToolProjection } from "@/lib/calculations/strokes";
import { autoEnsureMonthlySnapshots } from "@/lib/actions/monthly-stroke-snapshots";
import { formatNumber } from "@/lib/utils";
import { Controle50KFilters } from "./Controle50KFilters";
import { RegisterMaintenanceButton } from "./RegisterMaintenanceButton";
import { ExportButton } from "./ExportButton";
import { FullscreenButton } from "./FullscreenButton";
import Link from "next/link";

const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

const PT_MONTH_IDX: Record<string, number> = {
  Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5,
  Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11,
};

function sortMonthLabels(labels: string[]): string[] {
  return labels.sort((a, b) => labelToOrder(a) - labelToOrder(b));
}

// "Jun/2026" → ordem comparável (ano*12 + índice do mês).
function labelToOrder(label: string): number {
  const [m, y] = label.split("/");
  return parseInt(y) * 12 + (PT_MONTH_IDX[m] ?? 0);
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

// Detalha de quais produtos vieram as batidas previstas de um mês:
// cada parcela = volume previsto × qtd no BOM ÷ batidas por golpe.
function monthBreakdownText(p: ToolProjection, monthKey: string): string {
  const parts = p.productBreakdown
    .map((b) => ({ code: b.productCode, strokes: Math.round(b.strokesByMonth[monthKey] ?? 0) }))
    .filter((x) => x.strokes > 0);
  if (parts.length === 0) return "Sem previsão de volume para este mês.";
  const sum = parts.map((x) => `${x.code}: ${formatNumber(x.strokes)}`).join("  +  ");
  const total = formatNumber(parts.reduce((s, x) => s + x.strokes, 0));
  return parts.length > 1 ? `${sum}  =  ${total}` : sum;
}

export default async function Controle50KPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; press?: string; search?: string; page?: string; minStrokes?: string; reachesMonth?: string; reachesFrom?: string; reachesTo?: string; simulateDate?: string; sort?: string; statusView?: string; saldoSign?: string }>;
}) {
  const params = await searchParams;
  // Real é o padrão; só vai para estimado quando explicitamente pedido (?statusView=estimado).
  const isRealView = params.statusView !== "estimado";
  // Convenção do Saldo 50k: padrão = restante (limite − uso, negativo quando excede);
  // "excedente" inverte o sinal (positivo quando excede). A cor (vermelho = ruim) não muda.
  const saldoExcedente = params.saldoSign === "excedente";
  const showSaldo = (remaining: number) => Math.round(saldoExcedente ? -remaining : remaining);
  const minStrokes = params.minStrokes ? parseInt(params.minStrokes) : undefined;
  // Data simulada: trata a projeção como se "hoje" fosse essa data (para simular datas futuras).
  // Parseia ao meio-dia local para evitar deslocamento de fuso em strings YYYY-MM-DD.
  const referenceDate = params.simulateDate
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(params.simulateDate) ? `${params.simulateDate}T12:00:00` : params.simulateDate)
    : undefined;

  // Aguardado (não fire-and-forget): garante que os snapshots de meses fechados
  // existam ANTES de carregar os ferramentais, senão o render usa dados defasados
  // e, em serverless, a tarefa pendurada pode ser cortada ao retornar a resposta.
  await autoEnsureMonthlySnapshots(referenceDate);

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
      // Só a leitura mais recente do ciclo é usada na projeção; manter as últimas
      // poucas evita carregar o histórico inteiro (cresce indefinidamente) por load.
      orderBy: { readingDate: "desc" as const },
      take: 12,
    },
  } as const;

  // press/search restringem o conjunto carregado no banco; status/minStrokes/reaches
  // são aplicados em memória depois. Só vale carregar "todos os ativos" à parte
  // (para os contadores globais) quando há um desses filtros de banco; senão `tools`
  // já é o conjunto completo e é reusado — evita carregar a tabela inteira duas vezes.
  const hasDbToolFilter = Boolean(params.press || params.search);
  const [tools, allPresses] = await Promise.all([
    prisma.tool.findMany({
      where: {
        active: true,
        ...(params.press ? { press: params.press } : {}),
        ...(params.search ? { code: { contains: params.search, mode: "insensitive" } } : {}),
      },
      include: toolInclude,
      orderBy: { code: "asc" },
    }),
    prisma.tool.findMany({
      select: { press: true },
      distinct: ["press"],
      orderBy: { press: "asc" },
    }),
  ]);
  const allActiveTools = hasDbToolFilter
    ? await prisma.tool.findMany({
        where: { active: true },
        include: toolInclude,
        orderBy: { code: "asc" },
      })
    : tools;

  const windowDates = getWindowDates(referenceDate);

  // Status exibido: na visão real usa o efetivo (real, ou estimado como fallback);
  // na visão estimado usa o status projetado puro.
  const statusOf = (p: ToolProjection) => (isRealView ? p.effectiveStatus : p.status);

  // Counts are always global — all active tools, no filters
  const allProjections = getAllToolsProjection(allActiveTools, referenceDate);
  const counts = {
    total: allProjections.length,
    ok: allProjections.filter((p) => statusOf(p) === "OK").length,
    atencao: allProjections.filter((p) => statusOf(p) === "ATENCAO").length,
    programar: allProjections.filter((p) => statusOf(p) === "PROGRAMAR_PREVENTIVA").length,
    vencido: allProjections.filter((p) => statusOf(p) === "VENCIDO").length,
  };

  // Filtered projections for the table. Sem filtro de banco, `tools === allActiveTools`,
  // então reaproveita as projeções globais já calculadas em vez de recalcular tudo.
  let projections = hasDbToolFilter
    ? getAllToolsProjection(tools, referenceDate)
    : [...allProjections];

  if (params.status) {
    projections = projections.filter((p) => statusOf(p) === params.status);
  }

  // Filtra pelo acúmulo efetivamente exibido (Acúmulo Estimado), não pelo
  // currentStrokes cru do banco — assim o filtro bate com o número da tela.
  if (minStrokes) {
    projections = projections.filter((p) => Math.round(p.estimatedAccumulated) >= minStrokes);
  }

  // Available months derived from filtered projections (before reachesMonth filter)
  const availableMonths = sortMonthLabels(
    [...new Set(projections.map((p) => p.reachesLimitInMonth).filter((m): m is string => !!m))]
  );

  if (params.reachesMonth) {
    projections = projections.filter((p) => p.reachesLimitInMonth === params.reachesMonth);
  }

  // Filtro por intervalo do mês que atinge o limite (De/Até). Ferramentais que nunca
  // atingem (reachesLimitInMonth indefinido) ficam de fora quando há intervalo.
  const reachesFromOrder = params.reachesFrom ? labelToOrder(params.reachesFrom) : null;
  const reachesToOrder = params.reachesTo ? labelToOrder(params.reachesTo) : null;
  if (reachesFromOrder !== null || reachesToOrder !== null) {
    projections = projections.filter((p) => {
      if (!p.reachesLimitInMonth) return false;
      const order = labelToOrder(p.reachesLimitInMonth);
      if (reachesFromOrder !== null && order < reachesFromOrder) return false;
      if (reachesToOrder !== null && order > reachesToOrder) return false;
      return true;
    });
  }

  // Sem ordenação explícita, ordena pelo saldo da visão ativa (real por padrão).
  const sort = params.sort ?? (isRealView ? "real_asc" : "saldo_asc");
  projections = [...projections].sort((a, b) => {
    switch (sort) {
      case "saldo_desc":    return b.remainingStrokes - a.remainingStrokes;
      case "real_asc":      return a.currentRemainingStrokes - b.currentRemainingStrokes;
      case "real_desc":     return b.currentRemainingStrokes - a.currentRemainingStrokes;
      case "code_asc":      return a.code.localeCompare(b.code);
      case "code_desc":     return b.code.localeCompare(a.code);
      case "estimado_desc": return b.estimatedAccumulated - a.estimatedAccumulated;
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
    if (params.reachesFrom) urlParams.set("reachesFrom", params.reachesFrom);
    if (params.reachesTo) urlParams.set("reachesTo", params.reachesTo);
    if (params.simulateDate) urlParams.set("simulateDate", params.simulateDate);
    if (params.sort) urlParams.set("sort", params.sort);
    if (params.statusView) urlParams.set("statusView", params.statusView);
    if (params.saldoSign) urlParams.set("saldoSign", params.saldoSign);
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
    if (params.reachesFrom) urlParams.set("reachesFrom", params.reachesFrom);
    if (params.reachesTo) urlParams.set("reachesTo", params.reachesTo);
    if (params.simulateDate) urlParams.set("simulateDate", params.simulateDate);
    if (params.sort) urlParams.set("sort", params.sort);
    if (params.saldoSign) urlParams.set("saldoSign", params.saldoSign);
    // Real é o padrão (sem param). Estando em real, o toggle leva para estimado; estando em estimado, volta ao padrão.
    if (isRealView) urlParams.set("statusView", "estimado");
    const qs = urlParams.toString();
    return `/controle-50k${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      {referenceDate && (
        <div className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
          Simulando data: <strong>{referenceDate.toLocaleDateString("pt-BR")}</strong> — a projeção, status e janela de meses são calculados como se hoje fosse essa data.{" "}
          <a href="/controle-50k" className="underline font-medium">voltar para hoje</a>
        </div>
      )}
      <PageHeader
        title="Controle 50K"
        description="Previsão de batidas e controle preventivo de ferramentais"
        action={
          <div className="flex items-center gap-3">
            <ExportButton />
            <Link
              href="/manutencoes/nova"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
            >
              + Registrar Manutenção
            </Link>
          </div>
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

      {/* Legenda dos marcadores da tabela */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-semibold text-indigo-700 ring-1 ring-indigo-300">🔧</span>
          ciclo reiniciado nos últimos 30 dias (acúmulo ainda parcial)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-300">⚠ Nd</span>
          leitura física defasada há N dias (acúmulo real pode subcontar)
        </span>
      </div>

      <Controle50KFilters presses={allPresses.map((p) => p.press)} availableMonths={availableMonths} />

      {projections.length === 0 ? (
        <EmptyState
          title="Nenhum ferramental encontrado"
          description="Ajuste os filtros ou cadastre ferramentais para visualizar as projeções."
        />
      ) : (
        <div id="controle-50k-table" className="bg-white rounded-xlR border border-gray-200 shadow-sm overflow-hidden mt-4">
          <div className="flex justify-end border-b border-gray-200 px-3 py-2">
            <FullscreenButton targetId="controle-50k-table" scrollId="controle-50k-table-scroll" />
          </div>
          <div id="controle-50k-table-scroll" className="overflow-auto max-h-[calc(100vh-18rem)]">
            <table className="w-full table-fixed text-[11px] leading-tight">
              <thead className="sticky top-0 z-10 bg-gray-50 [&_th]:bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-[18%] px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                    Ferramental
                  </th>
                  <th className="w-[8.5%] px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                    Últ. manut.
                  </th>
                  <th className="w-[8.5%] px-3 py-2 text-right text-[10px] font-medium text-purple-600 uppercase">
                    Acúmulo Estimado
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
                    Saldo 50k Estimado 4 MESES
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
                {paginatedProjections.map((p) => {
                  const limit = formatNumber(p.preventiveLimit);
                  const accum = Math.round(p.estimatedAccumulated);
                  const futureWindow = Math.round(
                    p.window.filter((m) => m.offset > 0).reduce((s, m) => s + m.strokes, 0),
                  );
                  const hasCycle = p.lastMaintenanceDate !== null || p.realCycleStrokes !== null;
                  const projetadoTitle = hasCycle
                    ? `Projeção do ciclo até o fim da janela:\nacúmulo atual (${formatNumber(accum)}) + falta no mês (${formatNumber(p.currentMonthRemainingToDo)}) + meses futuros N+1..N+2 (${formatNumber(futureWindow)}) = ${formatNumber(Math.round(p.totalProjectedStrokes))}.`
                    : `Acúmulo atual (${formatNumber(accum)}) + previsão da janela de 4 meses (${formatNumber(Math.round(p.forecastedStrokes))}) = ${formatNumber(Math.round(p.totalProjectedStrokes))}.`;
                  return (
                  <tr
                    key={p.toolId}
                    className={`hover:bg-gray-50 ${
                      statusOf(p) === "VENCIDO"
                        ? "bg-red-50"
                        : statusOf(p) === "PROGRAMAR_PREVENTIVA"
                        ? "bg-orange-50"
                        : statusOf(p) === "ATENCAO"
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
                    <td
                      className="px-3 py-2 text-[10px] text-gray-600"
                      title={
                        p.lastMaintenanceDate
                          ? `Início do ciclo atual: última manutenção com reset do contador em ${formatDate(p.lastMaintenanceDate)}. Nada anterior a essa data conta para as 50k.`
                          : "Sem manutenção com reset registrada — o ciclo conta desde o início dos dados / batidas atuais cadastradas."
                      }
                    >
                      {formatDate(p.lastMaintenanceDate)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span
                        className="inline-flex items-center justify-end gap-1 font-medium text-purple-600"
                        title={
                          p.realCycleStrokes !== null
                            ? `Acúmulo Estimado (ancorado na leitura real):\nleitura ${formatNumber(p.realCycleStrokes)} (em ${formatDate(p.latestRealReadingDate)}) + ${formatNumber(accum - p.realCycleStrokes)} estimado pelos dias decorridos = ${formatNumber(accum)} batidas no ciclo.`
                            : `Acúmulo Estimado desde a última manutenção (sem leitura física neste ciclo).\nFórmula: meses fechados (volume × qtd no BOM ÷ batidas por golpe) + parte já decorrida do mês atual rateada por dias = ${formatNumber(accum)} batidas.`
                        }
                      >
                        {p.cycleRecentlyReset && (
                          <span
                            className="rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-semibold text-indigo-700 ring-1 ring-indigo-300"
                            title={`Ciclo reiniciado há ${p.daysSinceReset} dia(s) — acúmulo parcial do novo ciclo (conta poucos dias).`}
                          >
                            🔧
                          </span>
                        )}
                        <span>{formatNumber(accum)}</span>
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        p.realCycleStrokes !== null ? "font-medium text-blue-600" : "text-gray-400"
                      }`}
                      title={
                        p.realCycleStrokes !== null
                          ? `Leitura física crua do contador no ciclo: ${formatNumber(p.realCycleStrokes)} batidas em ${formatDate(p.latestRealReadingDate)}${
                              p.daysSinceLastReading !== null ? ` (há ${p.daysSinceLastReading} dia(s))` : ""
                            }.\nSaldo Real = ${limit} − ${formatNumber(p.realCycleStrokes)} = ${formatNumber(p.preventiveLimit - p.realCycleStrokes)}.`
                          : "Sem leitura física registrada neste ciclo. Registre uma leitura na página Leituras para ancorar o acúmulo real."
                      }
                    >
                      <div className="flex items-center justify-end gap-1">
                        {p.readingStale && (
                          <span
                            className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-300"
                            title={`Leitura defasada: ${p.daysSinceLastReading} dias sem nova medição. O acúmulo real pode estar subcontando — registre uma nova leitura.`}
                          >
                            ⚠ {p.daysSinceLastReading}d
                          </span>
                        )}
                        <span>{p.realCycleStrokes !== null ? formatNumber(p.realCycleStrokes) : "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                      <span
                        title={`Batidas que ainda faltam produzir no mês corrente.\nPrevisão do mês (${formatNumber(Math.round(p.currentMonthForecastedStrokes))}) − já decorrido desde o dia 1 rateado por dias (${formatNumber(Math.round(Math.max(0, p.currentMonthForecastedStrokes - p.currentMonthRemainingToDo)))}) = ${formatNumber(p.currentMonthRemainingToDo)}.${
                          p.hasMaintenanceInReferenceMonth ? "\n(Há manutenção neste mês: o ciclo novo começou no meio do mês.)" : ""
                        }`}
                      >
                        {formatNumber(p.currentMonthRemainingToDo)}
                      </span>
                    </td>
                    {p.window.map((m) => (
                      <td
                        key={m.key}
                        className={`px-3 py-2 text-right tabular-nums ${m.offset === 0 ? "font-medium text-blue-700" : "text-gray-700"}`}
                        title={`Batidas previstas em ${m.label} = Σ(volume previsto × qtd no BOM ÷ batidas por golpe) dos produtos:\n${monthBreakdownText(p, m.key)}`}
                      >
                        {m.strokes > 0 ? formatNumber(Math.round(m.strokes)) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold" title={projetadoTitle}>
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
                      title={`Saldo projetado ao fim da janela de 4 meses.\n${limit} (limite) − Projetado 4 Meses (${formatNumber(Math.round(p.totalProjectedStrokes))}) = ${formatNumber(Math.round(p.remainingStrokes))} batidas restantes.${
                        saldoExcedente ? "\n(Exibido como excedente: sinal invertido.)" : ""
                      }`}
                    >
                      {formatNumber(showSaldo(p.remainingStrokes))}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums font-semibold ${
                        p.currentRemainingStrokes < 0
                          ? "text-red-600"
                          : p.currentRemainingStrokes < 5000
                          ? "text-orange-600"
                          : "text-gray-900"
                      }`}
                      title={`Saldo de hoje, sem projetar meses futuros.\n${limit} (limite) − Acúmulo Estimado atual (${formatNumber(accum)}) = ${formatNumber(Math.round(p.currentRemainingStrokes))} batidas restantes.${
                        saldoExcedente ? "\n(Exibido como excedente: sinal invertido.)" : ""
                      }`}
                    >
                      {formatNumber(showSaldo(p.currentRemainingStrokes))}
                    </td>
                    <td
                      className="px-3 py-2"
                      title={`Status ${isRealView ? "Real" : "Estimado"}${
                        isRealView && p.statusFromEstimate ? " (sem leitura real — caiu para o estimado)" : ""
                      }.\nFaixas: OK < ${formatNumber(p.warningLimit - 5000)} · ATENÇÃO ${formatNumber(p.warningLimit - 5000)}–${formatNumber(p.warningLimit - 1)} · PROGRAMAR ${formatNumber(p.warningLimit)}–${formatNumber(p.preventiveLimit - 1)} · VENCIDO ≥ ${limit}.`}
                    >
                      <div className="flex items-center gap-1">
                        <StatusBadge status={statusOf(p)} />
                        {isRealView && p.statusFromEstimate && (
                          <span
                            className="text-[9px] font-medium text-gray-400"
                            title="Sem leitura real neste ciclo — status estimado pela previsão"
                          >
                            est.
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-3 py-2 text-[10px] text-gray-600"
                      title={
                        p.reachesLimitInMonth
                          ? `Mês projetado em que o acúmulo alcança o limite de ${limit} batidas, somando mês a mês a previsão a partir do acúmulo atual (${formatNumber(accum)}).`
                          : `Nos próximos 24 meses a projeção não alcança o limite de ${limit} batidas.`
                      }
                    >
                      {p.reachesLimitInMonth ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {(statusOf(p) === "PROGRAMAR_PREVENTIVA" || statusOf(p) === "VENCIDO") && (
                        <RegisterMaintenanceButton toolId={p.toolId} toolCode={p.code} />
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} buildPageUrl={buildPageUrl} scroll={false} />
        </div>
      )}
    </div>
  );
}
