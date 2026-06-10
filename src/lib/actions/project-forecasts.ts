"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function upsertProjectForecast(data: {
  projectId: string;
  referenceMonth: Date;
  plannedQuantity: number;
}) {
  try {
    const d = data.referenceMonth;
    // Componentes em UTC para não depender do fuso do servidor.
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    // Faixa do mês em UTC (meia-noite) localiza registros existentes, inclusive âncoras antigas.
    const monthStart = new Date(Date.UTC(y, m, 1));
    const monthEnd = new Date(Date.UTC(y, m + 1, 1));
    // Grava no meio-dia UTC: getMonth()/getDate() locais caem no mês certo em qualquer fuso.
    const monthAnchor = new Date(Date.UTC(y, m, 1, 12));

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
        data: { projectId: data.projectId, referenceMonth: monthAnchor, plannedQuantity: data.plannedQuantity },
      });
    }

    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao salvar volume do projeto." };
  }
}
