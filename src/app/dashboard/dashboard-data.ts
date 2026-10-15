import { autoEnsureMonthlySnapshots } from "@/lib/actions/monthly-stroke-snapshots";
import {
  getAllToolsProjection,
  type MaintenanceStatus,
  type ToolProjection,
} from "@/lib/calculations/strokes";
import { prisma } from "@/lib/prisma";

const ACTION_STATUS: MaintenanceStatus[] = [
  "VENCIDO",
  "PROGRAMAR_PREVENTIVA",
  "ATENCAO",
];

const STATUS_ORDER: Record<MaintenanceStatus, number> = {
  VENCIDO: 0,
  PROGRAMAR_PREVENTIVA: 1,
  ATENCAO: 2,
  ERRO_CADASTRO: 3,
  OK: 4,
};

// Metadados visuais por status — cor em hex porque o SVG do donut usa `fill`/`stroke`.
const STATUS_META: Record<MaintenanceStatus, { label: string; color: string }> = {
  VENCIDO: { label: "Vencido", color: "#dc2626" },
  PROGRAMAR_PREVENTIVA: { label: "Preventiva", color: "#ea580c" },
  ATENCAO: { label: "Atenção", color: "#eab308" },
  ERRO_CADASTRO: { label: "Erro cadastro", color: "#64748b" },
  OK: { label: "OK", color: "#16a34a" },
};

// Faixas de saldo 50K atual (limite − acúmulo de hoje). Ordenadas do mais crítico
// ao mais folgado. `urgent` marca as faixas que exigem ação (já vencido ou < 5k).
const SALDO_BUCKETS: { label: string; min: number; max: number; urgent: boolean }[] = [
  { label: "Vencido", min: -Infinity, max: 0, urgent: true },
  { label: "< 5k", min: 0, max: 5000, urgent: true },
  { label: "5–15k", min: 5000, max: 15000, urgent: false },
  { label: "15–30k", min: 15000, max: 30000, urgent: false },
  { label: "≥ 30k", min: 30000, max: Infinity, urgent: false },
];

const DONUT_ORDER: MaintenanceStatus[] = [
  "VENCIDO",
  "PROGRAMAR_PREVENTIVA",
  "ATENCAO",
  "ERRO_CADASTRO",
  "OK",
];

export type DashboardFilter = {
  press?: string;
  line?: string;
};

export type StatusSlice = {
  key: MaintenanceStatus;
  label: string;
  value: number;
  color: string;
};

const PT_MONTH_IDX: Record<string, number> = {
  Jan: 0,
  Fev: 1,
  Mar: 2,
  Abr: 3,
  Mai: 4,
  Jun: 5,
  Jul: 6,
  Ago: 7,
  Set: 8,
  Out: 9,
  Nov: 10,
  Dez: 11,
};

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export type ToolMaintenanceOption = {
  id: string;
  code: string;
  description: string | null;
  press: string;
  preventiveLimit: number;
  warningLimit: number;
  count: number;
};

export type ToolMaintenancePoint = {
  id: string;
  date: string;
  label: string;
  type: string;
  strokes: number;
  resetCounter: boolean;
  responsible: string | null;
  notes: string | null;
  daysSincePrevious: number | null;
};

export type ToolMaintenanceHistory = {
  toolId: string;
  code: string;
  description: string | null;
  press: string;
  warningLimit: number;
  preventiveLimit: number;
  points: ToolMaintenancePoint[];
  totalMaintenances: number;
  avgIntervalDays: number | null;
  minIntervalDays: number | null;
  maxIntervalDays: number | null;
  maxCycleStrokes: number | null;
  minCycleStrokes: number | null;
  correctiveCount: number;
  avgCycleStrokes: number | null;
  avgCycleUtilization: number | null;
  lastMaintenanceDate: string | null;
};

const DAY_MS = 1000 * 60 * 60 * 24;

const PT_MONTHS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonthLabel(date: Date): string {
  return `${PT_MONTHS_SHORT[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

function daysInMonthKey(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

/** Ferramentais que têm pelo menos uma manutenção registrada — alimenta o seletor. */
export async function getToolMaintenanceOptions(): Promise<ToolMaintenanceOption[]> {
  const tools = await prisma.tool.findMany({
    where: { maintenanceRecords: { some: {} } },
    select: {
      id: true,
      code: true,
      description: true,
      press: true,
      preventiveLimit: true,
      warningLimit: true,
      _count: { select: { maintenanceRecords: true } },
    },
    orderBy: { code: "asc" },
  });

  return tools.map((tool) => ({
    id: tool.id,
    code: tool.code,
    description: tool.description,
    press: tool.press,
    preventiveLimit: tool.preventiveLimit,
    warningLimit: tool.warningLimit,
    count: tool._count.maintenanceRecords,
  }));
}

export type MaintenanceTrendPoint = {
  key: string;
  label: string;
  preventivas: number;
  corretivas: number;
  outras: number;
  total: number;
};

/** Contagem de manutenções por mês nos últimos 12 meses (inclui o mês corrente),
 * separando preventivas de corretivas. Meses sem registro entram zerados. */
export async function getMaintenanceMonthlyTrend(): Promise<MaintenanceTrendPoint[]> {
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const records = await prisma.maintenanceRecord.findMany({
    where: { maintenanceDate: { gte: firstMonth } },
    select: { maintenanceDate: true, maintenanceType: true },
  });

  const buckets = new Map<string, MaintenanceTrendPoint>();
  for (let i = 0; i < 12; i += 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = monthKeyOf(monthDate);
    buckets.set(key, {
      key,
      label: shortMonthLabel(monthDate),
      preventivas: 0,
      corretivas: 0,
      outras: 0,
      total: 0,
    });
  }

  for (const record of records) {
    const key = monthKeyOf(record.maintenanceDate);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (record.maintenanceType === "Corretiva") bucket.corretivas += 1;
    else if (record.maintenanceType === "Preventiva") bucket.preventivas += 1;
    else bucket.outras += 1;
    bucket.total += 1;
  }

  return [...buckets.values()];
}

/** Histórico de manutenções de um ferramental, em ordem cronológica, com o intervalo
 * (em dias) entre cada manutenção e a anterior. */
export async function getToolMaintenanceHistory(
  toolId: string,
): Promise<ToolMaintenanceHistory | null> {
  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    select: {
      id: true,
      code: true,
      description: true,
      press: true,
      warningLimit: true,
      preventiveLimit: true,
      maintenanceRecords: {
        orderBy: { maintenanceDate: "asc" },
        select: {
          id: true,
          maintenanceDate: true,
          strokesAtMaintenance: true,
          maintenanceType: true,
          responsible: true,
          notes: true,
          resetCounter: true,
        },
      },
    },
  });

  if (!tool) return null;

  const intervals: number[] = [];
  const points: ToolMaintenancePoint[] = tool.maintenanceRecords.map((record, index) => {
    const previous = index > 0 ? tool.maintenanceRecords[index - 1] : null;
    const daysSincePrevious = previous
      ? Math.round(
          (record.maintenanceDate.getTime() - previous.maintenanceDate.getTime()) / DAY_MS,
        )
      : null;
    if (daysSincePrevious !== null) intervals.push(daysSincePrevious);

    return {
      id: record.id,
      date: record.maintenanceDate.toISOString(),
      label: record.maintenanceDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }),
      type: record.maintenanceType,
      strokes: record.strokesAtMaintenance,
      resetCounter: record.resetCounter,
      responsible: record.responsible,
      notes: record.notes,
      daysSincePrevious,
    };
  });

  const avgIntervalDays =
    intervals.length > 0
      ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
      : null;
  const minIntervalDays = intervals.length > 0 ? Math.min(...intervals) : null;
  const maxIntervalDays = intervals.length > 0 ? Math.max(...intervals) : null;

  const cycleStrokes = points.map((point) => point.strokes);
  const maxCycleStrokes = cycleStrokes.length > 0 ? Math.max(...cycleStrokes) : null;
  const minCycleStrokes = cycleStrokes.length > 0 ? Math.min(...cycleStrokes) : null;
  const avgCycleStrokes =
    cycleStrokes.length > 0
      ? Math.round(cycleStrokes.reduce((sum, value) => sum + value, 0) / cycleStrokes.length)
      : null;
  const avgCycleUtilization =
    avgCycleStrokes !== null && tool.preventiveLimit > 0
      ? avgCycleStrokes / tool.preventiveLimit
      : null;
  const correctiveCount = points.filter((point) => point.type === "Corretiva").length;

  return {
    toolId: tool.id,
    code: tool.code,
    description: tool.description,
    press: tool.press,
    warningLimit: tool.warningLimit,
    preventiveLimit: tool.preventiveLimit,
    points,
    totalMaintenances: points.length,
    avgIntervalDays,
    minIntervalDays,
    maxIntervalDays,
    maxCycleStrokes,
    minCycleStrokes,
    correctiveCount,
    avgCycleStrokes,
    avgCycleUtilization,
    lastMaintenanceDate: points.length > 0 ? points[points.length - 1].date : null,
  };
}

export type QualityIssue = {
  key: string;
  title: string;
  count: number;
  href: string;
  tone: "red" | "orange" | "yellow" | "blue";
  description: string;
};

type MaintenanceRow = {
  id: string;
  toolCode: string;
  toolPress: string;
  maintenanceDate: Date;
  maintenanceType: string;
  resetCounter: boolean;
  responsible: string | null;
};

function labelToOrder(label: string): number {
  const [month, year] = label.split("/");
  return parseInt(year, 10) * 12 + (PT_MONTH_IDX[month] ?? 0);
}

function statusOf(projection: ToolProjection) {
  return projection.effectiveStatus;
}

function sortByOperationalRisk(a: ToolProjection, b: ToolProjection) {
  const byStatus = STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)];
  if (byStatus !== 0) return byStatus;
  return a.currentRemainingStrokes - b.currentRemainingStrokes;
}

function getMaintenanceMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Estimativa (não medição) de dias até o acúmulo cruzar o limite preventivo (50k),
 * derivada do ritmo já projetado pelo sistema: total de batidas previstas na janela
 * de 4 meses ÷ dias corridos dessa janela. Retorna null quando não há previsão
 * (ritmo <= 0) — nesse caso não inventamos um número.
 */
function estimateDaysToPreventive(projection: ToolProjection): number | null {
  const windowStrokes = projection.window.reduce((sum, month) => sum + month.strokes, 0);
  const windowDays = projection.window.reduce((sum, month) => sum + daysInMonthKey(month.key), 0);
  if (windowStrokes <= 0 || windowDays <= 0) return null;
  const ratePerDay = windowStrokes / windowDays;
  if (ratePerDay <= 0) return null;
  const days = Math.round(projection.currentRemainingStrokes / ratePerDay);
  return Math.max(-9999, Math.min(days, 720));
}

export type MaintenanceForecastRow = {
  toolId: string;
  code: string;
  description: string | null;
  press: string;
  strokes: number;
  saldo: number;
  status: MaintenanceStatus;
  estimatedDays: number | null;
  bucket: "URGENTE" | "7_DIAS" | "30_DIAS";
};

export type MaintenanceForecast = {
  urgent: number;
  next7: number;
  next30: number;
  noEstimate: number;
  rows: MaintenanceForecastRow[];
};

function buildMaintenanceForecast(projections: ToolProjection[]): MaintenanceForecast {
  const urgent: MaintenanceForecastRow[] = [];
  const next7: MaintenanceForecastRow[] = [];
  const next30: MaintenanceForecastRow[] = [];
  let noEstimate = 0;

  for (const projection of projections) {
    if (projection.status === "ERRO_CADASTRO") continue;
    const status = statusOf(projection);
    const estimatedDays = estimateDaysToPreventive(projection);
    const row = {
      toolId: projection.toolId,
      code: projection.code,
      description: projection.description ?? null,
      press: projection.press,
      strokes: Math.round(projection.preventiveLimit - projection.currentRemainingStrokes),
      saldo: Math.round(projection.currentRemainingStrokes),
      status,
      estimatedDays,
    };

    if (status === "VENCIDO" || status === "PROGRAMAR_PREVENTIVA") {
      urgent.push({ ...row, bucket: "URGENTE" });
    } else if (estimatedDays !== null && estimatedDays >= 0 && estimatedDays <= 7) {
      next7.push({ ...row, bucket: "7_DIAS" });
    } else if (estimatedDays !== null && estimatedDays > 7 && estimatedDays <= 30) {
      next30.push({ ...row, bucket: "30_DIAS" });
    } else if (estimatedDays === null && Boolean(projection.reachesLimitInMonth)) {
      noEstimate += 1;
    }
  }

  const bySaldo = (a: MaintenanceForecastRow, b: MaintenanceForecastRow) => a.saldo - b.saldo;
  urgent.sort(bySaldo);
  next7.sort(bySaldo);
  next30.sort(bySaldo);

  return {
    urgent: urgent.length,
    next7: next7.length,
    next30: next30.length,
    noEstimate,
    rows: [...urgent, ...next7, ...next30].slice(0, 10),
  };
}

function getPlanningBuckets(projections: ToolProjection[]) {
  const buckets = new Map<string, { label: string; count: number; urgent: number }>();

  for (const projection of projections) {
    if (!projection.reachesLimitInMonth) continue;
    const bucket = buckets.get(projection.reachesLimitInMonth) ?? {
      label: projection.reachesLimitInMonth,
      count: 0,
      urgent: 0,
    };
    bucket.count += 1;
    if (ACTION_STATUS.includes(statusOf(projection))) bucket.urgent += 1;
    buckets.set(bucket.label, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => labelToOrder(a.label) - labelToOrder(b.label))
    .slice(0, 6);
}

function buildQualityIssues(params: {
  projections: ToolProjection[];
  toolsWithoutBom: number;
  productsWithoutBom: number;
  activeProjectsWithoutForecast: number;
  activeProductsWithoutForecast: number;
}) {
  const registrationErrors = params.projections.filter((p) => p.status === "ERRO_CADASTRO").length;
  const withoutReset = params.projections.filter((p) => !p.lastMaintenanceDate).length;

  const issues: QualityIssue[] = [
    {
      key: "registration-errors",
      title: "Erro de cadastro",
      count: registrationErrors,
      href: "/controle-50k?status=ERRO_CADASTRO",
      tone: "red",
      description: "Ferramentais com dados que impedem um cálculo confiável.",
    },
    {
      key: "tools-without-bom",
      title: "Ferramental sem BOM",
      count: params.toolsWithoutBom,
      href: "/bom",
      tone: "orange",
      description: "Sem vínculo produto/ferramental, a demanda não entra na projeção.",
    },
    {
      key: "without-reset",
      title: "Sem reset registrado",
      count: withoutReset,
      href: "/manutencoes",
      tone: "yellow",
      description: "O ciclo 50K fica menos rastreável sem uma manutenção de início.",
    },
    {
      key: "products-without-bom",
      title: "Produto sem BOM",
      count: params.productsWithoutBom,
      href: "/bom",
      tone: "blue",
      description: "Produtos ativos sem ferramenta associada não geram batidas.",
    },
    {
      key: "projects-without-forecast",
      title: "Projeto sem volume",
      count: params.activeProjectsWithoutForecast,
      href: "/volumes",
      tone: "blue",
      description: "Projetos ativos sem previsão não alimentam o planejamento.",
    },
    {
      key: "products-without-forecast",
      title: "Produto sem previsão",
      count: params.activeProductsWithoutForecast,
      href: "/volumes",
      tone: "blue",
      description: "Produtos sem previsão própria ou por projeto podem subcontar demanda.",
    },
  ];

  return issues.filter((issue) => issue.count > 0);
}

function buildStatusDistribution(projections: ToolProjection[]): StatusSlice[] {
  return DONUT_ORDER.map((status) => ({
    key: status,
    label: STATUS_META[status].label,
    color: STATUS_META[status].color,
    value: projections.filter((p) => statusOf(p) === status).length,
  }));
}

export type SaldoBucket = {
  label: string;
  count: number;
  urgent: boolean;
};

function buildSaldoDistribution(projections: ToolProjection[]): SaldoBucket[] {
  return SALDO_BUCKETS.map((bucket) => ({
    label: bucket.label,
    urgent: bucket.urgent,
    count: projections.filter((p) => {
      const saldo = Math.round(p.currentRemainingStrokes);
      return saldo >= bucket.min && saldo < bucket.max;
    }).length,
  }));
}

function distinctSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function matchesFilter(projection: ToolProjection, filter: DashboardFilter): boolean {
  if (filter.press && projection.press !== filter.press) return false;
  if (filter.line && (projection.line ?? "") !== filter.line) return false;
  return true;
}

export async function getDashboardData(filter: DashboardFilter = {}) {
  await autoEnsureMonthlySnapshots();

  const toolInclude = {
    bomItems: {
      include: {
        overrides: true,
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
    scheduledMaintenances: { where: { status: "PENDING" }, take: 1 },
    strokeReadings: {
      orderBy: { readingDate: "desc" as const },
      take: 12,
    },
  } as const;

  const maintenanceMonthStart = getMaintenanceMonthStart();
  const previousMonthStart = new Date(
    maintenanceMonthStart.getFullYear(),
    maintenanceMonthStart.getMonth() - 1,
    1,
  );

  const [
    tools,
    maintenancesThisMonth,
    maintenanceTypeGroups,
    maintenancesPrevMonth,
    recentMaintenances,
    toolsWithoutBom,
    productsWithoutBom,
    activeProjectsWithoutForecast,
    activeProductsWithoutForecast,
  ] = await Promise.all([
    prisma.tool.findMany({
      where: { active: true },
      include: toolInclude,
      orderBy: { code: "asc" },
    }),
    prisma.maintenanceRecord.count({
      where: {
        maintenanceDate: { gte: maintenanceMonthStart },
      },
    }),
    prisma.maintenanceRecord.groupBy({
      by: ["maintenanceType"],
      where: { maintenanceDate: { gte: maintenanceMonthStart } },
      _count: { _all: true },
    }),
    prisma.maintenanceRecord.count({
      where: {
        maintenanceDate: { gte: previousMonthStart, lt: maintenanceMonthStart },
      },
    }),
    prisma.maintenanceRecord.findMany({
      where: {
        maintenanceDate: { gte: maintenanceMonthStart },
      },
      include: {
        tool: { select: { code: true, press: true } },
      },
      orderBy: { maintenanceDate: "desc" },
      take: 5,
    }),
    prisma.tool.count({
      where: { active: true, bomItems: { none: {} } },
    }),
    prisma.product.count({
      where: { active: true, bomItems: { none: {} } },
    }),
    prisma.project.count({
      where: { active: true, forecasts: { none: {} } },
    }),
    prisma.product.count({
      where: {
        active: true,
        forecasts: { none: {} },
        projectProducts: { none: { project: { forecasts: { some: {} } } } },
      },
    }),
  ]);

  const allProjections = getAllToolsProjection(tools);

  // Opções de filtro derivam do conjunto completo (para permitir trocar a seleção),
  // mas todo o resto do painel usa as projeções já filtradas.
  const filterOptions = {
    presses: distinctSorted(allProjections.map((p) => p.press)),
    lines: distinctSorted(allProjections.map((p) => p.line)),
  };
  const projections = allProjections.filter((p) => matchesFilter(p, filter));

  const counts = {
    total: projections.length,
    ok: projections.filter((p) => statusOf(p) === "OK").length,
    atencao: projections.filter((p) => statusOf(p) === "ATENCAO").length,
    programar: projections.filter((p) => statusOf(p) === "PROGRAMAR_PREVENTIVA").length,
    vencido: projections.filter((p) => statusOf(p) === "VENCIDO").length,
    erro: projections.filter((p) => p.status === "ERRO_CADASTRO").length,
  };

  const actionQueue = projections
    .filter((p) => ACTION_STATUS.includes(statusOf(p)))
    .sort(sortByOperationalRisk)
    .slice(0, 8);

  const staleReadings = projections
    .filter((p) => p.readingStale)
    .sort((a, b) => (b.daysSinceLastReading ?? 0) - (a.daysSinceLastReading ?? 0))
    .slice(0, 5);

  const missingReadings = projections.filter((p) => p.statusFromEstimate).length;
  const staleReadingCount = projections.filter((p) => p.readingStale).length;

  const planningBuckets = getPlanningBuckets(projections);
  const statusDistribution = buildStatusDistribution(projections);
  const saldoDistribution = buildSaldoDistribution(projections);
  const maintenanceForecast = buildMaintenanceForecast(projections);

  const maintenancesByType = { preventiva: 0, corretiva: 0, outras: 0 };
  for (const group of maintenanceTypeGroups) {
    const amount = group._count._all;
    if (group.maintenanceType === "Preventiva") maintenancesByType.preventiva += amount;
    else if (group.maintenanceType === "Corretiva") maintenancesByType.corretiva += amount;
    else maintenancesByType.outras += amount;
  }

  const qualityIssues = buildQualityIssues({
    projections,
    toolsWithoutBom,
    productsWithoutBom,
    activeProjectsWithoutForecast,
    activeProductsWithoutForecast,
  });

  const recentMaintenanceRows: MaintenanceRow[] = recentMaintenances.map((maintenance) => ({
    id: maintenance.id,
    toolCode: maintenance.tool.code,
    toolPress: maintenance.tool.press,
    maintenanceDate: maintenance.maintenanceDate,
    maintenanceType: maintenance.maintenanceType,
    resetCounter: maintenance.resetCounter,
    responsible: maintenance.responsible,
  }));

  return {
    counts,
    actionQueue,
    staleReadings,
    missingReadings,
    staleReadingCount,
    maintenancesThisMonth,
    maintenancesByType,
    maintenancesPrevMonth,
    maintenanceForecast,
    recentMaintenances: recentMaintenanceRows,
    planningBuckets,
    qualityIssues,
    statusDistribution,
    saldoDistribution,
    filterOptions,
    appliedFilter: filter,
  };
}
