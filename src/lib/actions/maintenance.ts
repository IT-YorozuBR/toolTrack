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
    const record = await prisma.maintenanceRecord.create({
      data: {
        toolId: data.toolId,
        maintenanceDate: data.maintenanceDate,
        strokesAtMaintenance: data.strokesAtMaintenance,
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
