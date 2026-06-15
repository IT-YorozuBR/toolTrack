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

// Peso de "saúde" por status (0–100). O health score é a média desses pesos.
const HEALTH_WEIGHT: Record<MaintenanceStatus, number> = {
  OK: 100,
  ATENCAO: 65,
  PROGRAMAR_PREVENTIVA: 40,
  ERRO_CADASTRO: 30,
  VENCIDO: 0,
};

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

function buildHealthScore(projections: ToolProjection[]): number {
  if (projections.length === 0) return 100;
  const total = projections.reduce((sum, p) => sum + HEALTH_WEIGHT[statusOf(p)], 0);
  return Math.round(total / projections.length);
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
      take: 12,
    },
  } as const;

  const maintenanceMonthStart = getMaintenanceMonthStart();

  const [
    tools,
    maintenancesThisMonth,
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
  const healthScore = buildHealthScore(projections);

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
    recentMaintenances: recentMaintenanceRows,
    planningBuckets,
    qualityIssues,
    statusDistribution,
    healthScore,
    filterOptions,
    appliedFilter: filter,
  };
}
