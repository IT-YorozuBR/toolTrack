"use server";

import { revalidatePath } from "next/cache";

import { calculateClosedMonthStrokes, calculateForecastedStrokes, calculateStrokesForMonth, toMonthKey as calcMonthKey } from "@/lib/calculations/strokes";
import { prisma } from "@/lib/prisma";

type ClosePreviousMonthOptions = {
  referenceDate?: Date;
  overwrite?: boolean;
  includeInactive?: boolean;
};

type ClosedToolSnapshot = {
  toolId: string;
  code: string;
  strokes: number;
  appliedStrokes: number;
  currentStrokes: number;
  action: "created" | "updated" | "skipped";
};

type ClosePreviousMonthResult = {
  success: true;
  referenceMonth: string;
  created: number;
  updated: number;
  skipped: number;
  tools: ClosedToolSnapshot[];
} | {
  success: false;
  error: string;
};

const SNAPSHOT_SOURCE = "monthly-close:forecast";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getPreviousMonthRange(referenceDate: Date) {
  const currentMonthStart = startOfMonth(referenceDate);
  const previousMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 1, 1);

  return {
    monthStart: previousMonthStart,
    monthEnd: currentMonthStart,
  };
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isWithinMonth(date: Date, monthStart: Date, monthEnd: Date) {
  return date >= monthStart && date < monthEnd;
}

async function findToolsForMonthlyClosing(monthStart: Date, monthEnd: Date, includeInactive: boolean) {
  return prisma.tool.findMany({
    where: includeInactive ? undefined : { active: true },
    include: {
      bomItems: {
        include: {
          product: {
            include: {
              forecasts: {
                where: { referenceMonth: { gte: monthStart, lt: monthEnd } },
              },
              projectProducts: {
                include: {
                  project: {
                    include: {
                      forecasts: {
                        where: { referenceMonth: { gte: monthStart, lt: monthEnd } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      maintenanceRecords: {
        where: {
          resetCounter: true,
          maintenanceDate: { lt: monthEnd },
        },
        orderBy: { maintenanceDate: "desc" },
      },
    },
    orderBy: { code: "asc" },
  });
}

export async function closePreviousMonthToolStrokeSnapshots(
  options: ClosePreviousMonthOptions = {},
): Promise<ClosePreviousMonthResult> {
  try {
    const { monthStart, monthEnd } = getPreviousMonthRange(options.referenceDate ?? new Date());
    const tools = await findToolsForMonthlyClosing(monthStart, monthEnd, options.includeInactive ?? false);
    const existingSnapshots = await prisma.toolMonthlyStrokeSnapshot.findMany({
      where: { referenceMonth: monthStart },
      select: { id: true, toolId: true },
    });
    const existingByToolId = new Map(existingSnapshots.map((snapshot) => [snapshot.toolId, snapshot]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const results: ClosedToolSnapshot[] = [];

    for (const tool of tools) {
      const monthlyStrokes = Math.round(calculateForecastedStrokes(tool, monthStart));
      const latestReset = tool.maintenanceRecords[0];
      const resetInClosedMonth = latestReset
        ? isWithinMonth(latestReset.maintenanceDate, monthStart, monthEnd)
        : false;
      const appliedStrokes = calculateClosedMonthStrokes(tool, monthStart);
      const currentStrokes = (resetInClosedMonth ? 0 : tool.currentStrokes) + appliedStrokes;
      const existing = existingByToolId.get(tool.id);

      if (existing && !options.overwrite) {
        skipped += 1;
        results.push({
          toolId: tool.id,
          code: tool.code,
          strokes: monthlyStrokes,
          appliedStrokes,
          currentStrokes: tool.currentStrokes,
          action: "skipped",
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.toolMonthlyStrokeSnapshot.update({
            where: { id: existing.id },
            data: {
              strokes: appliedStrokes,
              forecastStrokes: monthlyStrokes,
              cycleStartedAt: latestReset?.maintenanceDate ?? null,
              source: SNAPSHOT_SOURCE,
            },
          });
          updated += 1;
        } else {
          await tx.toolMonthlyStrokeSnapshot.create({
            data: {
              toolId: tool.id,
              referenceMonth: monthStart,
              strokes: appliedStrokes,
              forecastStrokes: monthlyStrokes,
              cycleStartedAt: latestReset?.maintenanceDate ?? null,
              source: SNAPSHOT_SOURCE,
            },
          });
          created += 1;
        }

        await tx.tool.update({
          where: { id: tool.id },
          data: { currentStrokes },
        });
      });

      results.push({
        toolId: tool.id,
        code: tool.code,
        strokes: monthlyStrokes,
        appliedStrokes,
        currentStrokes,
        action: existing ? "updated" : "created",
      });
    }

    revalidatePath("/ferramentais");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");

    return {
      success: true,
      referenceMonth: toMonthKey(monthStart),
      created,
      updated,
      skipped,
      tools: results,
    };
  } catch {
    return { success: false, error: "Erro ao fechar historico mensal de batidas." };
  }
}

export async function getToolMonthlyStrokeSnapshots(toolId: string) {
  return prisma.toolMonthlyStrokeSnapshot.findMany({
    where: { toolId },
    orderBy: { referenceMonth: "desc" },
  });
}

export async function closePreviousMonthToolStrokeSnapshotsFromForm(
  _previousState: ClosePreviousMonthResult | null,
  formData: FormData,
): Promise<ClosePreviousMonthResult> {
  return closePreviousMonthToolStrokeSnapshots({
    overwrite: formData.get("overwrite") === "on",
    includeInactive: formData.get("includeInactive") === "on",
  });
}

// Auto-fecha todos os meses fechados sem snapshot desde o último reset de cada ferramental.
// Idempotente: pula meses que já têm snapshot.
export async function autoEnsureMonthlySnapshots(referenceDate?: Date): Promise<void> {
  const today = referenceDate ?? new Date();
  const currentMonthStart = startOfMonth(today);

  const tools = await prisma.tool.findMany({
    where: { active: true },
    include: {
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
        orderBy: { maintenanceDate: "asc" },
      },
      monthlySnapshots: {
        orderBy: { referenceMonth: "asc" },
      },
    },
  });

  // Coleta todos os snapshots faltantes e grava num único createMany (skipDuplicates
  // cobre corridas e meses já fechados) em vez de um upsert sequencial por mês/ferramenta.
  const toCreate: {
    toolId: string;
    referenceMonth: Date;
    strokes: number;
    forecastStrokes: number;
    cycleStartedAt: Date | null;
    source: string;
  }[] = [];

  for (const tool of tools) {
    const lastReset = tool.maintenanceRecords.at(-1);
    const cycleStart = lastReset ? startOfMonth(lastReset.maintenanceDate) : startOfMonth(tool.maintenanceRecords[0]?.maintenanceDate ?? today);
    const snapshotKeys = new Set(tool.monthlySnapshots.map((s) => toMonthKey(new Date(s.referenceMonth))));

    let cursor = new Date(cycleStart);
    while (cursor < currentMonthStart) {
      const key = toMonthKey(cursor);
      if (!snapshotKeys.has(key)) {
        const referenceMonth = new Date(cursor);
        toCreate.push({
          toolId: tool.id,
          referenceMonth,
          strokes: calculateClosedMonthStrokes(tool, referenceMonth),
          forecastStrokes: Math.round(calculateStrokesForMonth(tool, calcMonthKey(referenceMonth))),
          cycleStartedAt: lastReset?.maintenanceDate ?? null,
          source: "auto:forecast",
        });
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  if (toCreate.length > 0) {
    await prisma.toolMonthlyStrokeSnapshot.createMany({ data: toCreate, skipDuplicates: true });
  }
}

export type SnapshotHistoryRow = {
  snapshotId: string | null;
  toolId: string;
  toolCode: string;
  toolDescription: string | null;
  productId: string;
  productCode: string;
  referenceMonth: string;
  estimatedStrokes: number;
  actualStrokes: number | null;
  source: string;
};

export async function getSnapshotHistory(
  fromMonth: string,
  toMonth: string,
  productIds: string[],
): Promise<SnapshotHistoryRow[]> {
  const [fromYear, fromMon] = fromMonth.split("-").map(Number);
  const [toYear, toMon] = toMonth.split("-").map(Number);
  const fromDate = new Date(fromYear, fromMon - 1, 1);
  const toDate = new Date(toYear, toMon, 1); // exclusive

  const tools = await prisma.tool.findMany({
    where: {
      bomItems: { some: { productId: { in: productIds } } },
    },
    include: {
      bomItems: {
        where: { productId: { in: productIds } },
        include: { product: { select: { id: true, code: true } } },
      },
      monthlySnapshots: {
        where: { referenceMonth: { gte: fromDate, lt: toDate } },
        orderBy: { referenceMonth: "asc" },
      },
    },
    orderBy: { code: "asc" },
  });

  const rows: SnapshotHistoryRow[] = [];

  for (const tool of tools) {
    for (const bomItem of tool.bomItems) {
      let cursor = new Date(fromDate);
      while (cursor < toDate) {
        const key = toMonthKey(cursor);
        const snapshot = tool.monthlySnapshots.find((s) => toMonthKey(new Date(s.referenceMonth)) === key);
        rows.push({
          snapshotId: snapshot?.id ?? null,
          toolId: tool.id,
          toolCode: tool.code,
          toolDescription: tool.description,
          productId: bomItem.product.id,
          productCode: bomItem.product.code,
          referenceMonth: key,
          estimatedStrokes: snapshot?.strokes ?? 0,
          actualStrokes: snapshot?.actualStrokes ?? null,
          source: snapshot?.source ?? "sem snapshot",
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
  }

  return rows;
}

export async function updateSnapshotActualStrokes(
  snapshotId: string,
  actualStrokes: number | null,
): Promise<void> {
  await prisma.toolMonthlyStrokeSnapshot.update({
    where: { id: snapshotId },
    data: { actualStrokes },
  });
  revalidatePath("/controle-50k");
  revalidatePath("/fechamento-mensal");
}
