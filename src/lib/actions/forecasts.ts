"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function upsertProductionForecast(data: {
  productId: string;
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

    const existing = await prisma.productionForecast.findFirst({
      where: { productId: data.productId, referenceMonth: { gte: monthStart, lt: monthEnd } },
    });

    const summary = `produto ${data.productId}, mês ${monthAnchor.toISOString().slice(0, 7)}`;
    if (existing) {
      if (data.plannedQuantity <= 0) {
        await prisma.productionForecast.delete({ where: { id: existing.id } });
        await logAudit({ entity: "ProductionForecast", entityId: existing.id, action: "DELETE", summary, before: existing });
      } else {
        const updated = await prisma.productionForecast.update({
          where: { id: existing.id },
          data: { plannedQuantity: data.plannedQuantity },
        });
        await logAudit({
          entity: "ProductionForecast",
          entityId: existing.id,
          action: "UPDATE",
          summary,
          before: existing,
          after: updated,
        });
      }
    } else if (data.plannedQuantity > 0) {
      const created = await prisma.productionForecast.create({
        data: { productId: data.productId, referenceMonth: monthAnchor, plannedQuantity: data.plannedQuantity },
      });
      await logAudit({ entity: "ProductionForecast", entityId: created.id, action: "CREATE", summary, after: created });
    }

    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao salvar volume." };
  }
}

export async function getForecasts() {
  return prisma.productionForecast.findMany({ include: { product: true }, orderBy: [{ referenceMonth: "desc" }, { product: { code: "asc" } }] });
}

export async function createProductionForecast(data: { productId: string; referenceMonth: Date; plannedQuantity: number }) {
  try {
    const forecast = await prisma.productionForecast.create({ data, include: { product: true } });
    await logAudit({
      entity: "ProductionForecast",
      entityId: forecast.id,
      action: "CREATE",
      summary: `${forecast.product.code}, mês ${forecast.referenceMonth.toISOString().slice(0, 7)}`,
      after: forecast,
    });
    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: forecast };
  } catch {
    return { success: false, error: "Erro ao criar previsão de volume." };
  }
}

export async function updateProductionForecast(id: string, data: { plannedQuantity: number }) {
  try {
    const before = await prisma.productionForecast.findUnique({ where: { id }, include: { product: true } });
    const forecast = await prisma.productionForecast.update({ where: { id }, data, include: { product: true } });
    await logAudit({
      entity: "ProductionForecast",
      entityId: id,
      action: "UPDATE",
      summary: `${forecast.product.code}, mês ${forecast.referenceMonth.toISOString().slice(0, 7)}`,
      before,
      after: forecast,
    });
    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: forecast };
  } catch {
    return { success: false, error: "Erro ao atualizar previsão de volume." };
  }
}

export async function deleteProductionForecast(id: string) {
  try {
    const before = await prisma.productionForecast.findUnique({ where: { id }, include: { product: true } });
    await prisma.productionForecast.delete({ where: { id } });
    await logAudit({
      entity: "ProductionForecast",
      entityId: id,
      action: "DELETE",
      summary: before ? `${before.product.code}, mês ${before.referenceMonth.toISOString().slice(0, 7)}` : undefined,
      before,
    });
    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao excluir previsão de volume." };
  }
}
