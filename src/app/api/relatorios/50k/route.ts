import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateStrokesForMonth,
  getAllToolsProjection,
  toMonthKey,
  type MaintenanceStatus,
} from "@/lib/calculations/strokes";
import {
  buildReportWorkbook,
  type DemandReportRow,
  type MaintenanceReportRow,
} from "@/lib/reports/buildWorkbook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PT_MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

function monthLabel(date: Date): string {
  return `${PT_MONTHS[date.getMonth()]}/${date.getFullYear()}`;
}

// "Jun/2026" → ordem comparável (ano*12 + índice do mês).
function labelToOrder(label: string): number {
  const [m, y] = label.split("/");
  const idx = PT_MONTHS.indexOf(m as (typeof PT_MONTHS)[number]);
  return parseInt(y, 10) * 12 + (idx >= 0 ? idx : 0);
}


// Parse "YYYY-MM-DD" no fuso local (evita o deslocamento de dia do parse UTC).
function parseLocalDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function monthsBetween(from: Date, to: Date): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  // Trava de segurança contra intervalos absurdos.
  let guard = 0;
  while (cursor <= end && guard < 120) {
    months.push({ key: toMonthKey(cursor), label: monthLabel(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
    guard++;
  }
  return months;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const press = sp.get("press") ?? undefined;
  const search = sp.get("search") ?? undefined;
  const statusParam = sp.get("status") ?? undefined;
  const minStrokesParam = sp.get("minStrokes");
  const minStrokes = minStrokesParam ? parseInt(minStrokesParam, 10) : undefined;
  const reachesMonth = sp.get("reachesMonth") ?? undefined;
  const simulateDate = sp.get("simulateDate") ?? undefined;
  const isRealView = sp.get("statusView") !== "estimado";

  const referenceDate = simulateDate
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(simulateDate) ? `${simulateDate}T12:00:00` : simulateDate)
    : undefined;
  const today = referenceDate ?? new Date();

  // Defaults: 12 meses atrás → 12 meses à frente, caso o gatilho não envie.
  const from =
    parseLocalDate(sp.get("from")) ??
    new Date(today.getFullYear(), today.getMonth() - 12, 1);
  const toRaw =
    parseLocalDate(sp.get("to")) ??
    new Date(today.getFullYear(), today.getMonth() + 12, 1);
  const to = new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate(), 23, 59, 59, 999);

  // Mesmo include da página /controle-50k, para as projeções baterem 1:1.
  const toolInclude = {
    bomItems: {
      include: {
        product: {
          include: {
            forecasts: true,
            projectProducts: {
              include: { project: { include: { forecasts: true } } },
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
    monthlySnapshots: { orderBy: { referenceMonth: "asc" as const } },
    strokeReadings: { orderBy: { readingDate: "desc" as const } },
  } as const;

  const toolWhere = {
    active: true,
    ...(press ? { press } : {}),
    ...(search ? { code: { contains: search, mode: "insensitive" as const } } : {}),
    ...(minStrokes ? { currentStrokes: { gte: minStrokes } } : {}),
  };

  const tools = await prisma.tool.findMany({
    where: toolWhere,
    include: toolInclude,
    orderBy: { code: "asc" },
  });

  // --- Status 50K + Preventivas: mesma lógica/filtros da tela ---
  let projections = getAllToolsProjection(tools, referenceDate);
  if (statusParam) {
    projections = projections.filter(
      (p) => (isRealView ? p.effectiveStatus : p.status) === statusParam,
    );
  }
  if (reachesMonth) {
    projections = projections.filter((p) => p.reachesLimitInMonth === reachesMonth);
  }
  const reachesFromParam = sp.get("reachesFrom");
  const reachesToParam = sp.get("reachesTo");
  const reachesFromOrder = reachesFromParam ? labelToOrder(reachesFromParam) : null;
  const reachesToOrder = reachesToParam ? labelToOrder(reachesToParam) : null;
  if (reachesFromOrder !== null || reachesToOrder !== null) {
    projections = projections.filter((p) => {
      if (!p.reachesLimitInMonth) return false;
      const order = labelToOrder(p.reachesLimitInMonth);
      if (reachesFromOrder !== null && order < reachesFromOrder) return false;
      if (reachesToOrder !== null && order > reachesToOrder) return false;
      return true;
    });
  }
  // Ordena por saldo (real por padrão), mantendo sem-leitura no fim.
  projections = [...projections].sort((a, b) => {
    if (isRealView) {
      const av = a.realRemainingStrokes;
      const bv = b.realRemainingStrokes;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    }
    return a.remainingStrokes - b.remainingStrokes;
  });

  // --- Histórico de Manutenções (por período) ---
  const maintenanceRecords = await prisma.maintenanceRecord.findMany({
    where: {
      maintenanceDate: { gte: from, lte: to },
      tool: { active: true, ...(press ? { press } : {}) },
    },
    include: { tool: { select: { code: true, press: true } } },
    orderBy: { maintenanceDate: "desc" },
  });
  const maintenances: MaintenanceReportRow[] = maintenanceRecords.map((m) => ({
    toolCode: m.tool.code,
    press: m.tool.press,
    maintenanceDate: m.maintenanceDate,
    maintenanceType: m.maintenanceType,
    strokesAtMaintenance: m.strokesAtMaintenance,
    responsible: m.responsible,
    resetCounter: m.resetCounter,
    notes: m.notes,
  }));

  // --- Demanda → Batidas (por período, mesmas ferramentas filtradas) ---
  const demandMonths = monthsBetween(from, toRaw);
  const demandRows: DemandReportRow[] = tools
    .map((tool) => {
      const byMonth: Record<string, number> = {};
      let total = 0;
      for (const m of demandMonths) {
        const strokes = Math.round(calculateStrokesForMonth(tool, m.key));
        byMonth[m.key] = strokes;
        total += strokes;
      }
      return { toolCode: tool.code, press: tool.press, byMonth, total };
    })
    .filter((r) => r.total > 0);

  const buffer = buildReportWorkbook({
    generatedAt: new Date(),
    filters: {
      press,
      status: statusParam as MaintenanceStatus | undefined,
      search,
      simulateDate,
      saldoSign: sp.get("saldoSign") ?? undefined,
      from,
      to: toRaw,
    },
    projections,
    maintenances,
    demand: { months: demandMonths, rows: demandRows },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `relatorio-50k-${stamp}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
