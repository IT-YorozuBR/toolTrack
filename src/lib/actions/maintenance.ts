"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
    const tool = await prisma.tool.findUnique({
      where: { id: data.toolId },
      select: { currentStrokes: true },
    });
    if (!tool) {
      return { success: false, error: "Ferramental não encontrado." };
    }

    const record = await prisma.maintenanceRecord.create({
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
      await prisma.tool.update({
        where: { id: data.toolId },
        data: { currentStrokes: 0 },
      });
    }

    revalidatePath("/manutencoes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: record };
  } catch {
    return { success: false, error: "Erro ao registrar manutenção." };
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

    revalidatePath("/manutencoes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    revalidatePath("/ferramentais");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao excluir manutenção." };
  }
}
