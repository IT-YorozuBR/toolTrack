"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  calculateClosedMonthStrokes,
  calculateStrokesForMonth,
  toMonthKey,
} from "@/lib/calculations/strokes";
import { logAudit } from "@/lib/audit";

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function getMaintenanceRecords() {
  return prisma.maintenanceRecord.findMany({
    include: { tool: true },
    orderBy: { maintenanceDate: "desc" },
  });
}

export async function createMaintenanceRecord(data: {
  toolId: string;
  maintenanceDate: Date;
  strokesAtMaintenance: number;
  maintenanceType: string;
  responsible?: string;
  notes?: string;
  resetCounter?: boolean;
}) {
  try {
    // Carrega o ferramental com tudo que o cálculo de batidas estimadas precisa
    // (BOM + previsões + resets), para re-ancorar os snapshots dos meses do ciclo.
    const tool = await prisma.tool.findUnique({
      where: { id: data.toolId },
      include: {
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
        maintenanceRecords: { where: { resetCounter: true } },
      },
    });
    if (!tool) {
      return { success: false, error: "Ferramental não encontrado." };
    }

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRecord.create({
        data: {
          toolId: data.toolId,
          maintenanceDate: data.maintenanceDate,
          strokesAtMaintenance: data.strokesAtMaintenance,
          // Guarda o acúmulo real antes do reset para permitir reversão exata na exclusão.
          previousStrokes: tool.currentStrokes,
          maintenanceType: data.maintenanceType,
          responsible: data.responsible,
          notes: data.notes,
          resetCounter: data.resetCounter ?? true,
        },
      });

      if (data.resetCounter) {
        await tx.tool.update({
          where: { id: data.toolId },
          data: { currentStrokes: 0 },
        });

        // Re-ancora os snapshots dos meses FECHADOS do novo ciclo (do mês da
        // manutenção até o mês anterior ao atual). Sem isso, os snapshots antigos
        // mantêm o cycleStartedAt do ciclo anterior e o autoEnsure não os reescreve
        // (createMany skipDuplicates), então o acúmulo retroativo "some". O mês
        // corrente fica de fora — é recalculado dinamicamente (currentMonthElapsed).
        // toolForCalc inclui o novo reset para que o mês da manutenção seja rateado
        // a partir do dia do reset (não o mês inteiro).
        const toolForCalc = {
          ...tool,
          maintenanceRecords: [
            ...tool.maintenanceRecords,
            {
              maintenanceDate: data.maintenanceDate,
              resetCounter: true,
              strokesAtMaintenance: data.strokesAtMaintenance,
            },
          ],
        };

        const currentMonthStart = startOfMonth(new Date());
        let cursor = startOfMonth(data.maintenanceDate);
        while (cursor < currentMonthStart) {
          const referenceMonth = new Date(cursor);
          const strokes = calculateClosedMonthStrokes(toolForCalc, referenceMonth);
          const forecastStrokes = Math.round(
            calculateStrokesForMonth(toolForCalc, toMonthKey(referenceMonth)),
          );
          await tx.toolMonthlyStrokeSnapshot.upsert({
            where: {
              toolId_referenceMonth: { toolId: data.toolId, referenceMonth },
            },
            create: {
              toolId: data.toolId,
              referenceMonth,
              strokes,
              forecastStrokes,
              cycleStartedAt: data.maintenanceDate,
              source: "maintenance:reset",
            },
            update: {
              strokes,
              forecastStrokes,
              cycleStartedAt: data.maintenanceDate,
              source: "maintenance:reset",
            },
          });
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }
      }

      return created;
    });

    await logAudit({
      entity: "MaintenanceRecord",
      entityId: record.id,
      action: "CREATE",
      summary: `${tool.code}: ${data.maintenanceType}${data.resetCounter ?? true ? " (zera contador)" : ""}`,
      after: record,
    });

    revalidatePath("/manutencoes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: record };
  } catch {
    return { success: false, error: "Erro ao registrar manutenção." };
  }
}

// Edita uma manutenção existente. Campos que não afetam o contador/snapshots
// (tipo, responsável, observação) podem ser alterados em qualquer registro.
// Campos que afetam o ciclo (data, batidas no momento, zerar contador) só podem
// ser alterados no registro MAIS RECENTE do ferramental, pela mesma razão que
// a exclusão tem essa restrição: a reversão/reaplicação do efeito no contador
// só é bem-definida para o último evento do ciclo.
export async function updateMaintenanceRecord(
  id: string,
  data: {
    maintenanceDate: Date;
    strokesAtMaintenance: number;
    maintenanceType: string;
    responsible?: string;
    notes?: string;
    resetCounter?: boolean;
  },
) {
  try {
    const existing = await prisma.maintenanceRecord.findUnique({
      where: { id },
      select: {
        id: true,
        toolId: true,
        maintenanceDate: true,
        strokesAtMaintenance: true,
        previousStrokes: true,
        resetCounter: true,
      },
    });
    if (!existing) {
      return { success: false, error: "Manutenção não encontrada." };
    }

    const latest = await prisma.maintenanceRecord.findFirst({
      where: { toolId: existing.toolId },
      orderBy: [{ maintenanceDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    const isLatest = latest?.id === existing.id;

    const nextResetCounter = data.resetCounter ?? true;
    const cycleFieldsChanged =
      existing.maintenanceDate.getTime() !== data.maintenanceDate.getTime() ||
      existing.strokesAtMaintenance !== data.strokesAtMaintenance ||
      existing.resetCounter !== nextResetCounter;

    if (cycleFieldsChanged && !isLatest) {
      return {
        success: false,
        error:
          "Só é possível alterar data, batidas e contador na manutenção mais recente do ferramental.",
      };
    }

    if (!cycleFieldsChanged) {
      const record = await prisma.maintenanceRecord.update({
        where: { id },
        data: {
          maintenanceType: data.maintenanceType,
          responsible: data.responsible ?? null,
          notes: data.notes ?? null,
        },
      });
      await logAudit({
        entity: "MaintenanceRecord",
        entityId: id,
        action: "UPDATE",
        summary: `${data.maintenanceType} (só metadados)`,
        before: existing,
        after: record,
      });
      revalidatePath("/manutencoes");
      return { success: true, data: record };
    }

    const tool = await prisma.tool.findUnique({
      where: { id: existing.toolId },
      include: {
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
        maintenanceRecords: { where: { resetCounter: true } },
      },
    });
    if (!tool) {
      return { success: false, error: "Ferramental não encontrado." };
    }

    const record = await prisma.$transaction(async (tx) => {
      // Desfaz os snapshots re-ancorados pelo ciclo anterior desta manutenção.
      await tx.toolMonthlyStrokeSnapshot.deleteMany({
        where: { toolId: existing.toolId, cycleStartedAt: existing.maintenanceDate },
      });

      // Restaura o contador ao valor anterior a este ciclo, para então reaplicar
      // o novo ciclo a partir do mesmo ponto de partida usado pela exclusão.
      const strokesBeforeThisCycle = existing.resetCounter
        ? existing.previousStrokes ?? existing.strokesAtMaintenance
        : tool.currentStrokes;

      const updated = await tx.maintenanceRecord.update({
        where: { id },
        data: {
          maintenanceDate: data.maintenanceDate,
          strokesAtMaintenance: data.strokesAtMaintenance,
          previousStrokes: strokesBeforeThisCycle,
          maintenanceType: data.maintenanceType,
          responsible: data.responsible,
          notes: data.notes,
          resetCounter: nextResetCounter,
        },
      });

      if (nextResetCounter) {
        await tx.tool.update({
          where: { id: existing.toolId },
          data: { currentStrokes: 0 },
        });

        const toolForCalc = {
          ...tool,
          currentStrokes: strokesBeforeThisCycle,
          maintenanceRecords: [
            ...tool.maintenanceRecords.filter((m) => m.maintenanceDate.getTime() !== existing.maintenanceDate.getTime()),
            {
              maintenanceDate: data.maintenanceDate,
              resetCounter: true,
              strokesAtMaintenance: data.strokesAtMaintenance,
            },
          ],
        };

        const currentMonthStart = startOfMonth(new Date());
        let cursor = startOfMonth(data.maintenanceDate);
        while (cursor < currentMonthStart) {
          const referenceMonth = new Date(cursor);
          const strokes = calculateClosedMonthStrokes(toolForCalc, referenceMonth);
          const forecastStrokes = Math.round(
            calculateStrokesForMonth(toolForCalc, toMonthKey(referenceMonth)),
          );
          await tx.toolMonthlyStrokeSnapshot.upsert({
            where: {
              toolId_referenceMonth: { toolId: existing.toolId, referenceMonth },
            },
            create: {
              toolId: existing.toolId,
              referenceMonth,
              strokes,
              forecastStrokes,
              cycleStartedAt: data.maintenanceDate,
              source: "maintenance:reset",
            },
            update: {
              strokes,
              forecastStrokes,
              cycleStartedAt: data.maintenanceDate,
              source: "maintenance:reset",
            },
          });
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }
      } else {
        await tx.tool.update({
          where: { id: existing.toolId },
          data: { currentStrokes: strokesBeforeThisCycle },
        });
      }

      return updated;
    });

    await logAudit({
      entity: "MaintenanceRecord",
      entityId: id,
      action: "UPDATE",
      summary: `${tool.code}: ${data.maintenanceType} (altera ciclo)`,
      before: existing,
      after: record,
    });

    revalidatePath("/manutencoes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: record };
  } catch {
    return { success: false, error: "Erro ao editar manutenção." };
  }
}

// Exclui uma manutenção e reverte o ferramental ao estado anterior a ela.
// Só é permitido excluir o registro MAIS RECENTE do ferramental: a reversão
// "ao status anterior" só é bem-definida para o último evento do ciclo.
export async function deleteMaintenanceRecord(id: string) {
  try {
    const record = await prisma.maintenanceRecord.findUnique({
      where: { id },
      select: {
        id: true,
        toolId: true,
        maintenanceDate: true,
        strokesAtMaintenance: true,
        previousStrokes: true,
        resetCounter: true,
      },
    });

    if (!record) {
      return { success: false, error: "Manutenção não encontrada." };
    }

    const latest = await prisma.maintenanceRecord.findFirst({
      where: { toolId: record.toolId },
      orderBy: [{ maintenanceDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    if (latest?.id !== record.id) {
      return {
        success: false,
        error: "Só é possível excluir a manutenção mais recente do ferramental.",
      };
    }

    await prisma.$transaction(async (tx) => {
      // Remove snapshots mensais ancorados nesta manutenção (cycleStartedAt == data),
      // que de outra forma ficariam órfãos e seriam ignorados nos cálculos.
      await tx.toolMonthlyStrokeSnapshot.deleteMany({
        where: { toolId: record.toolId, cycleStartedAt: record.maintenanceDate },
      });

      await tx.maintenanceRecord.delete({ where: { id: record.id } });

      // Se a manutenção zerou o contador, restaura o acúmulo anterior.
      // previousStrokes (exato) com fallback para strokesAtMaintenance em registros antigos.
      if (record.resetCounter) {
        await tx.tool.update({
          where: { id: record.toolId },
          data: { currentStrokes: record.previousStrokes ?? record.strokesAtMaintenance },
        });
      }
    });

    await logAudit({
      entity: "MaintenanceRecord",
      entityId: id,
      action: "DELETE",
      summary: `ferramental ${record.toolId}`,
      before: record,
    });

    revalidatePath("/manutencoes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    revalidatePath("/ferramentais");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao excluir manutenção." };
  }
}
