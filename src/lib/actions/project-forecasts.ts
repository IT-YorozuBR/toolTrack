"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function upsertProjectForecast(data: {
  projectId: string;
  referenceMonth: Date;
  plannedQuantity: number;
}) {
  try {
    const monthStart = new Date(data.referenceMonth.getFullYear(), data.referenceMonth.getMonth(), 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

    const existing = await prisma.projectForecast.findFirst({
      where: { projectId: data.projectId, referenceMonth: { gte: monthStart, lt: monthEnd } },
    });

    if (existing) {
      if (data.plannedQuantity <= 0) {
        await prisma.projectForecast.delete({ where: { id: existing.id } });
      } else {
        await prisma.projectForecast.update({
          where: { id: existing.id },
          data: { plannedQuantity: data.plannedQuantity },
        });
      }
    } else if (data.plannedQuantity > 0) {
      await prisma.projectForecast.create({
        data: { projectId: data.projectId, referenceMonth: monthStart, plannedQuantity: data.plannedQuantity },
      });
    }

    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao salvar volume do projeto." };
  }
}
