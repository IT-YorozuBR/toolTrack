"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

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

    const summary = `projeto ${data.projectId}, mês ${monthAnchor.toISOString().slice(0, 7)}`;
    if (existing) {
      if (data.plannedQuantity <= 0) {
        await prisma.projectForecast.delete({ where: { id: existing.id } });
        await logAudit({ entity: "ProjectForecast", entityId: existing.id, action: "DELETE", summary, before: existing });
      } else {
        const updated = await prisma.projectForecast.update({
          where: { id: existing.id },
          data: { plannedQuantity: data.plannedQuantity },
        });
        await logAudit({
          entity: "ProjectForecast",
          entityId: existing.id,
          action: "UPDATE",
          summary,
          before: existing,
          after: updated,
        });
      }
    } else if (data.plannedQuantity > 0) {
      const created = await prisma.projectForecast.create({
        data: { projectId: data.projectId, referenceMonth: monthAnchor, plannedQuantity: data.plannedQuantity },
      });
      await logAudit({ entity: "ProjectForecast", entityId: created.id, action: "CREATE", summary, after: created });
    }

    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao salvar volume do projeto." };
  }
}
