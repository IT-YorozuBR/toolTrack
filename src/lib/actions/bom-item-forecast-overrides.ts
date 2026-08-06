"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function upsertBomItemForecastOverride(data: {
  bomItemId: string;
  referenceMonth: Date;
  plannedQuantity: number;
}) {
  try {
    const d = data.referenceMonth;
    // Componentes em UTC para não depender do fuso do servidor.
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1));
    const monthEnd = new Date(Date.UTC(y, m + 1, 1));
    const monthAnchor = new Date(Date.UTC(y, m, 1, 12));

    const existing = await prisma.bomItemForecastOverride.findFirst({
      where: { bomItemId: data.bomItemId, referenceMonth: { gte: monthStart, lt: monthEnd } },
    });

    const summary = `bomItem ${data.bomItemId}, mês ${monthAnchor.toISOString().slice(0, 7)}`;
    if (existing) {
      if (data.plannedQuantity <= 0) {
        await prisma.bomItemForecastOverride.delete({ where: { id: existing.id } });
        await logAudit({
          entity: "BomItemForecastOverride",
          entityId: existing.id,
          action: "DELETE",
          summary,
          before: existing,
        });
      } else {
        const updated = await prisma.bomItemForecastOverride.update({
          where: { id: existing.id },
          data: { plannedQuantity: data.plannedQuantity },
        });
        await logAudit({
          entity: "BomItemForecastOverride",
          entityId: existing.id,
          action: "UPDATE",
          summary,
          before: existing,
          after: updated,
        });
      }
    } else if (data.plannedQuantity > 0) {
      const created = await prisma.bomItemForecastOverride.create({
        data: { bomItemId: data.bomItemId, referenceMonth: monthAnchor, plannedQuantity: data.plannedQuantity },
      });
      await logAudit({
        entity: "BomItemForecastOverride",
        entityId: created.id,
        action: "CREATE",
        summary,
        after: created,
      });
    }

    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao salvar volume da ferramenta." };
  }
}

// Remove o override e volta a herdar a demanda do Projeto/Produto para este par.
export async function deleteBomItemForecastOverride(bomItemId: string, referenceMonth: Date) {
  return upsertBomItemForecastOverride({ bomItemId, referenceMonth, plannedQuantity: 0 });
}
